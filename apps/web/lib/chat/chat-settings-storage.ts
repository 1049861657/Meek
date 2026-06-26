import {
  CHAT_SETTINGS_KEY,
  type ChatSettingsStorage,
  type PermissionMode,
} from './storage-contract';

const VALID_PERMISSION_MODES: PermissionMode[] = ['open', 'interactive', 'locked'];

export function loadChatSettings(): ChatSettingsStorage {
  try {
    const raw = localStorage.getItem(CHAT_SETTINGS_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as ChatSettingsStorage;
  } catch {
    return {};
  }
}

export function saveChatSettings(settings: ChatSettingsStorage): void {
  try {
    localStorage.setItem(CHAT_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* storage quota / private mode */
  }
}

export function buildChatSettingsFromState(state: {
  model: string;
  compactModel: string;
  temperature: number;
  maxTokens: number;
  skipMemory: boolean;
  enableAutoCompact: boolean;
  enableMCPTools: boolean;
  enablePrompts: boolean;
  enableMessageHistory: boolean;
  messageHistoryCount: number;
  maxToolCallRounds: number;
  permissionMode: PermissionMode;
  enabledServerIds: string[];
  enabledSystemToolNames: string[];
}): ChatSettingsStorage {
  const settings: ChatSettingsStorage = {
    isStreamMode: true,
    model: state.model,
    compactModel: state.compactModel,
    temperature: state.temperature,
    maxTokens: state.maxTokens,
    skipMemory: state.skipMemory,
    enableAutoCompact: state.enableAutoCompact,
    enableMCPTools: state.enableMCPTools,
    enablePrompts: state.enablePrompts,
    enableMessageHistory: state.enableMessageHistory,
    messageHistoryCount: state.messageHistoryCount,
    maxToolCallRounds: state.maxToolCallRounds,
    enabledServerIds: [...state.enabledServerIds],
    enabledSystemToolNames: [...state.enabledSystemToolNames],
  };
  if (VALID_PERMISSION_MODES.includes(state.permissionMode)) {
    settings.permissionMode = state.permissionMode;
  }
  return settings;
}

export const DEFAULT_CHAT_SETTINGS: Required<
  Pick<
    ChatSettingsStorage,
    | 'temperature'
    | 'maxTokens'
    | 'enableMCPTools'
    | 'enablePrompts'
    | 'enableMessageHistory'
    | 'messageHistoryCount'
    | 'maxToolCallRounds'
    | 'permissionMode'
    | 'skipMemory'
  >
> = {
  temperature: 0.7,
  maxTokens: 2048,
  enableMCPTools: true,
  enablePrompts: true,
  enableMessageHistory: true,
  messageHistoryCount: 20,
  maxToolCallRounds: 25,
  permissionMode: 'open',
  skipMemory: false,
};
