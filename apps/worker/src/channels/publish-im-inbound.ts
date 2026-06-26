import { publishInbound } from '@meek/message-bus';

import type { DingtalkBotMessageDownstream } from './dingtalk/dingtalk-event.types.js';
import {
  DingtalkInboundSkipError,
  normalizeDingtalkInbound,
} from './dingtalk/normalize-dingtalk-inbound.js';
import type { FeishuReceiveMessageEvent } from './feishu/feishu-event.types.js';
import {
  FeishuInboundSkipError,
  normalizeFeishuInbound,
} from './feishu/normalize-feishu-inbound.js';

/**
 * 飞书 im.message.receive_v1 → normalize → publishInbound。
 * M5-04 listener 调用；handler 不 await Harness。
 */
export async function publishFeishuInboundFromEvent(
  event: FeishuReceiveMessageEvent
): Promise<void> {
  try {
    const envelope = normalizeFeishuInbound(event);
    await publishInbound(envelope);
  } catch (error: unknown) {
    if (error instanceof FeishuInboundSkipError) {
      console.debug(`[FEISHU] ${error.message}`);
      return;
    }
    console.error('[FEISHU] 入站事件处理失败:', error);
  }
}

/**
 * 钉钉 Stream robot 消息 → normalize → publishInbound。
 * M5-05 listener 调用；handler 不 await Harness。
 */
export async function publishDingtalkInboundFromDownstream(
  downstream: DingtalkBotMessageDownstream
): Promise<void> {
  try {
    const envelope = normalizeDingtalkInbound(downstream);
    await publishInbound(envelope);
  } catch (error: unknown) {
    if (error instanceof DingtalkInboundSkipError) {
      console.debug(`[DINGTALK] ${error.message}`);
      return;
    }
    console.error('[DINGTALK] 入站事件处理失败:', error);
  }
}
