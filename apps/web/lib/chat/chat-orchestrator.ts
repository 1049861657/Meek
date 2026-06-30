/**
 * 聊天 API 编排（无 React/DOM）— 对齐 chat-api.js + app-core 发送链路
 */

import {
  beginCompactConsumeTracking,
  consumeContextCompression,
  persistMessageHistoryGuest,
  saveCompactedBaselineToStorage,
  shouldConsumeAfterSuccessfulSend,
  type CompactConsumeMarker,
} from './compact-baseline-storage';
import { buildChatStreamRequestBody, type PermissionMode } from './chat-request-body';
import {
  authedContextFields,
  buildBaseContextMessages,
  buildOutgoingMessages,
  type ChatContextState,
} from './context-messages';
import type { ApiMessage } from './message-history-builder';
import {
  fetchAvailableMcpTools,
  fetchMcpServers,
  getSelectableMcpServerIds,
  probeMcpServers,
} from './mcp-selection';
import type { ChatSessionStore } from './session-store';
import { TurnCollector } from './turn-collector';
import type { CompactedBaselineStorage, HistoryEntry } from './storage-contract';

export interface ChatOrchestratorState extends ChatContextState {
  isConfigLoaded: boolean;
  enableMCPTools: boolean;
  enablePrompts: boolean;
  maxToolCallRounds: number;
  enableAutoCompact: boolean;
  compactModel: string;
  permissionMode: PermissionMode;
  skipMemory: boolean;
  enabledServerIds: string[];
  enabledSystemToolNames: string[];
  mcpServers: Array<{ id: string; toolsEnabled?: number }>;
  compactDraft: ApiMessage | null;
  contextCompactedActive: boolean;
  vendor: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface StreamOrchestrationRuntime {
  turnCollector: TurnCollector | null;
  userAborted: boolean;
  requestId: string | null;
  autoCompactSummaryFromStream: string | null;
  compactConsumeMarker: CompactConsumeMarker | null;
}

export interface BuildStreamRequestParams {
  message: string;
  enableMcpTools: boolean;
  isAuthed: boolean;
}

export class ChatOrchestrator {
  readonly streamRuntime: StreamOrchestrationRuntime = {
    turnCollector: null,
    userAborted: false,
    requestId: null,
    autoCompactSummaryFromStream: null,
    compactConsumeMarker: null,
  };

  constructor(
    public state: ChatOrchestratorState,
    private readonly sessionStore: ChatSessionStore,
    private readonly persistGuestHistory: (entries: HistoryEntry[]) => void
  ) {}

  resetStreamRuntime(): void {
    this.streamRuntime.userAborted = false;
    this.streamRuntime.requestId = null;
    this.streamRuntime.turnCollector = new TurnCollector();
    this.streamRuntime.autoCompactSummaryFromStream = null;
  }

  beginSend(message: string): void {
    this.resetStreamRuntime();
    this.streamRuntime.compactConsumeMarker = beginCompactConsumeTracking(
      this.state.messageHistory.length,
      this.state.apiContextOverride
    );
    this.state.messageHistory.push({ role: 'user', content: message });
  }

  buildStreamRequestBody(params: BuildStreamRequestParams): Record<string, unknown> {
    const { message, enableMcpTools, isAuthed } = params;
    const outgoing = isAuthed
      ? undefined
      : buildOutgoingMessages(this.state, message);
    const mcpServerIds = enableMcpTools
      ? getSelectableMcpServerIds(this.state.enabledServerIds, this.state.mcpServers)
      : undefined;
    const contextOptions = isAuthed
      ? { messageHistoryCount: this.state.messageHistoryCount }
      : undefined;

    return buildChatStreamRequestBody({
      message,
      messages: outgoing?.length ? outgoing : undefined,
      model: this.state.model,
      temperature: this.state.temperature,
      maxTokens: this.state.maxTokens,
      vendor: this.state.vendor,
      enableTools: enableMcpTools,
      enablePrompts: this.state.enablePrompts,
      maxToolCallRounds: this.state.maxToolCallRounds,
      enableAutoCompact: this.state.enableAutoCompact,
      compactModel: this.state.compactModel,
      mcpServerIds,
      enabledSystemToolNames: [...this.state.enabledSystemToolNames],
      permissionMode: this.state.permissionMode,
      skipMemory: this.state.skipMemory,
      sessionId: this.state.sessionId,
      contextOptions,
    });
  }

  async ensureActiveSessionBeforeSend(): Promise<void> {
    await this.sessionStore.ensureActiveSession();
  }

  finalizeSuccessfulStream(fullText: string): HistoryEntry[] {
    const entries =
      this.streamRuntime.turnCollector?.toHistoryEntries(fullText) ?? [
        { role: 'assistant' as const, content: fullText },
      ];

    for (const entry of entries) {
      this.state.messageHistory.push(entry);
    }

    if (
      shouldConsumeAfterSuccessfulSend(
        this.streamRuntime.userAborted,
        this.streamRuntime.compactConsumeMarker,
        this.streamRuntime.autoCompactSummaryFromStream
      )
    ) {
      this.applyCompactConsumption();
    }

    persistMessageHistoryGuest({ isAuthed: () => this.sessionStore.isAuthed() }, () => {
      this.persistGuestHistory(this.state.messageHistory);
    });

    return entries;
  }

  handleStreamAborted(): void {
    const last = this.state.messageHistory[this.state.messageHistory.length - 1];
    if (last?.role === 'user') {
      this.state.messageHistory.pop();
    }
    this.streamRuntime.compactConsumeMarker = null;
    this.streamRuntime.autoCompactSummaryFromStream = null;
  }

  setAutoCompactSummary(summary: string): void {
    this.streamRuntime.autoCompactSummaryFromStream = summary;
  }

  setRequestId(requestId: string): void {
    this.streamRuntime.requestId = requestId;
  }

  applyCompactConsumption(): void {
    const result = consumeContextCompression(
      this.streamRuntime.compactConsumeMarker,
      this.streamRuntime.autoCompactSummaryFromStream
    );
    this.streamRuntime.compactConsumeMarker = null;
    this.streamRuntime.autoCompactSummaryFromStream = null;

    if (!result.compactedBaseline) {
      return;
    }

    this.state.compactedBaseline = result.compactedBaseline;
    this.state.apiContextOverride = null;
    this.state.compactDraft = null;
    this.state.contextCompactedActive = false;
    saveCompactedBaselineToStorage(
      {
        sessionId: this.state.sessionId,
        compactedBaseline: this.state.compactedBaseline,
      },
      { isAuthed: () => this.sessionStore.isAuthed() }
    );
  }

  resetContextCompressionState(options: { clearBaseline?: boolean } = {}): void {
    const { clearBaseline = true } = options;
    this.state.apiContextOverride = null;
    this.state.compactDraft = null;
    this.state.contextCompactedActive = false;
    this.streamRuntime.compactConsumeMarker = null;
    this.streamRuntime.autoCompactSummaryFromStream = null;

    if (clearBaseline) {
      this.state.compactedBaseline = null;
      saveCompactedBaselineToStorage(
        { sessionId: this.state.sessionId, compactedBaseline: null },
        { isAuthed: () => this.sessionStore.isAuthed() }
      );
    }
  }

  buildContextPreviewBody(): Record<string, unknown> {
    const messages = buildBaseContextMessages(this.state);
    return {
      messages: this.sessionStore.isAuthed() ? [] : messages,
      vendor: this.state.vendor,
      enableAutoCompact: this.state.enableAutoCompact,
      contextOverride: this.state.apiContextOverride?.length
        ? this.state.apiContextOverride
        : null,
      ...authedContextFields(this.state, { isAuthed: () => this.sessionStore.isAuthed() }),
    };
  }

  buildCompactRequestBody(): Record<string, unknown> {
    const messages = buildBaseContextMessages(this.state);
    return {
      messages: this.sessionStore.isAuthed() ? [] : messages,
      vendor: this.state.vendor,
      compactModel: this.state.compactModel,
      ...authedContextFields(this.state, { isAuthed: () => this.sessionStore.isAuthed() }),
    };
  }

  applyCompactOverride(draft: ApiMessage): void {
    this.state.compactedBaseline = null;
    saveCompactedBaselineToStorage(
      { sessionId: this.state.sessionId, compactedBaseline: null },
      { isAuthed: () => this.sessionStore.isAuthed() }
    );
    this.state.apiContextOverride = [draft];
    this.state.contextCompactedActive = true;
  }

  // —— MCP API 薄封装 ——
  getMCPServers = fetchMcpServers;
  probeMcpServers = probeMcpServers;
  getAvailableMCPTools = fetchAvailableMcpTools;
}

export function createInitialOrchestratorState(
  partial: Partial<ChatOrchestratorState> = {}
): ChatOrchestratorState {
  return {
    messageHistory: [],
    messageHistoryCount: 20,
    enableMessageHistory: true,
    compactedBaseline: null,
    apiContextOverride: null,
    sessionId: '',
    isConfigLoaded: false,
    enableMCPTools: true,
    enablePrompts: true,
    maxToolCallRounds: 25,
    enableAutoCompact: false,
    compactModel: '',
    permissionMode: 'open',
    skipMemory: false,
    enabledServerIds: [],
    enabledSystemToolNames: [],
    mcpServers: [],
    compactDraft: null,
    contextCompactedActive: false,
    vendor: '',
    model: '',
    temperature: 0.7,
    maxTokens: 4096,
    ...partial,
  };
}

export type { CompactedBaselineStorage };
