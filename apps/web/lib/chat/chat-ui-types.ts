export type ToolCallStatus = 'running' | 'success' | 'error' | 'approval';

export interface PermissionRequestState {
  toolCallId: string;
  codeName: string;
  toolName: string;
  argsPreview: string;
  reason: string;
  permissionSessionKey: string;
}

export interface ToolCallProgressState {
  progress: number;
  total?: number;
  message?: string;
  elapsedMs?: number;
}

export interface ToolCallProgressStep {
  progress: number;
  total?: number;
  message?: string;
  elapsedMs?: number;
}

export interface ToolCallState {
  id: string;
  name: string;
  source?: 'system' | 'mcp';
  args: string;
  argsComplete: boolean;
  status: ToolCallStatus;
  result?: string;
  resultError?: boolean;
  executionTime?: number;
  permission?: PermissionRequestState;
  progress?: ToolCallProgressState;
  progressSteps?: ToolCallProgressStep[];
  planningItems?: PlanningItemState[];
  revision?: number;
}

export interface UserMessage {
  id: string;
  role: 'user';
  content: string;
}

export interface TokenUsageDisplayState {
  totalTokens: number;
  promptTokens?: number;
  completionTokens?: number;
  stepDelta?: number;
  round?: number;
  phase: 'streaming' | 'done';
  title: string;
  showIncrement: boolean;
}

export interface PlanningItemState {
  id?: string;
  content?: string;
  status?: string;
  [key: string]: unknown;
}

export interface AssistantMessage {
  id: string;
  role: 'assistant';
  content: string;
  reasoning?: string;
  toolCalls: ToolCallState[];
  isStreaming: boolean;
  isError?: boolean;
  contextCompacted?: boolean;
  elapsedSeconds?: number;
  tokenUsage?: TokenUsageDisplayState;
  planningItems?: PlanningItemState[];
}

export type ChatMessage = UserMessage | AssistantMessage;

export function createAssistantMessage(id: string): AssistantMessage {
  return {
    id,
    role: 'assistant',
    content: '',
    toolCalls: [],
    isStreaming: true,
  };
}

export function createUserMessage(id: string, content: string): UserMessage {
  return {
    id,
    role: 'user',
    content,
  };
}
