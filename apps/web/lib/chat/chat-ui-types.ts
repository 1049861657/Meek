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
}

export interface UserMessage {
  id: string;
  role: 'user';
  content: string;
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
