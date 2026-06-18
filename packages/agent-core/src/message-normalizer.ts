import { ChatCompletionMessageParam } from 'openai/resources/chat/completions.mjs';
import { InternalMessage } from './types.js';

const INTERNAL_FIELD_KEYS = ['_source', '_internal', '_timestamp'] as const;

const CANCELLED_TOOL_RESULT = '(cancelled)';

function stripInternalFields(message: InternalMessage): ChatCompletionMessageParam {
  const copy = { ...message } as Record<string, unknown>;
  for (const key of INTERNAL_FIELD_KEYS) {
    delete copy[key];
  }
  return copy as unknown as ChatCompletionMessageParam;
}

function getStringContent(message: ChatCompletionMessageParam): string {
  const { content } = message;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((part): part is { type: 'text'; text: string } =>
        typeof part === 'object' &&
        part !== null &&
        'type' in part &&
        part.type === 'text' &&
        typeof part.text === 'string'
      )
      .map(part => part.text)
      .join('\n');
  }
  return '';
}

function setStringContent(message: ChatCompletionMessageParam, content: string): void {
  (message as { content: string }).content = content;
}

function hasToolCalls(message: ChatCompletionMessageParam): boolean {
  return message.role === 'assistant' &&
    'tool_calls' in message &&
    Array.isArray(message.tool_calls) &&
    message.tool_calls.length > 0;
}

function canMergeMessages(
  previous: ChatCompletionMessageParam,
  current: ChatCompletionMessageParam
): boolean {
  if (previous.role !== current.role) {
    return false;
  }
  if (previous.role === 'tool') {
    return false;
  }
  if (previous.role === 'assistant' && (hasToolCalls(previous) || hasToolCalls(current))) {
    return false;
  }
  return true;
}

function mergeMessageContent(
  target: ChatCompletionMessageParam,
  source: ChatCompletionMessageParam
): void {
  const merged = [getStringContent(target), getStringContent(source)]
    .filter(part => part.length > 0)
    .join('\n');
  setStringContent(target, merged);
}

/**
 * 补齐 assistant.tool_calls 缺失的 tool_result（取消 mid-tool 时常见）
 */
function fillMissingToolResults(messages: ChatCompletionMessageParam[]): ChatCompletionMessageParam[] {
  const output: ChatCompletionMessageParam[] = [];
  let index = 0;

  while (index < messages.length) {
    const message = messages[index];
    if (!message) {
      index += 1;
      continue;
    }

    if (message.role === 'assistant' && hasToolCalls(message)) {
      output.push(message);
      const assistantWithTools = message as ChatCompletionMessageParam & {
        tool_calls: Array<{ id: string }>;
      };
      const expectedIds = assistantWithTools.tool_calls.map((toolCall) => toolCall.id);
      const fulfilledIds = new Set<string>();

      index += 1;
      while (index < messages.length && messages[index]?.role === 'tool') {
        const toolMessage = messages[index];
        if (!toolMessage) {
          break;
        }
        output.push(toolMessage);
        const toolCallId = (toolMessage as { tool_call_id?: string }).tool_call_id;
        if (toolCallId) {
          fulfilledIds.add(toolCallId);
        }
        index += 1;
      }

      for (const toolCallId of expectedIds) {
        if (!fulfilledIds.has(toolCallId)) {
          output.push({
            role: 'tool',
            tool_call_id: toolCallId,
            content: CANCELLED_TOOL_RESULT
          });
        }
      }
      continue;
    }

    output.push(message);
    index += 1;
  }

  return output;
}

/**
 * 合并连续同角色消息，满足 user/assistant 严格交替约束
 */
function mergeConsecutiveSameRole(messages: ChatCompletionMessageParam[]): ChatCompletionMessageParam[] {
  const output: ChatCompletionMessageParam[] = [];

  for (const message of messages) {
    const previous = output[output.length - 1];
    if (previous && canMergeMessages(previous, message)) {
      mergeMessageContent(previous, message);
      continue;
    }
    output.push({ ...message });
  }

  return output;
}

/**
 * 发送 LLM API 前规范化内部消息：
 * 1. 剥离 _internal / _timestamp / _source
 * 2. 补齐缺失 tool_result（占位 `(cancelled)`）
 * 3. 合并连续同角色消息
 */
export function normalizeMessages(messages: readonly InternalMessage[]): ChatCompletionMessageParam[] {
  const stripped = messages.map(stripInternalFields);
  const withToolResults = fillMissingToolResults(stripped);
  return mergeConsecutiveSameRole(withToolResults);
}
