import { DWClient, TOPIC_ROBOT } from 'dingtalk-stream';

import { publishDingtalkInboundFromDownstream } from '../publish-im-inbound.js';
import type { DingtalkBotMessageDownstream } from './dingtalk-event.types.js';

export type DingtalkLinkStatus = 'connected' | 'connecting' | 'disconnected' | 'skipped';

let streamClient: DWClient | null = null;
let linkStatus: DingtalkLinkStatus = 'skipped';

export function getDingtalkLinkStatus(): DingtalkLinkStatus {
  return linkStatus;
}

function readDingtalkCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.DINGTALK_CLIENT_ID?.trim();
  const clientSecret = process.env.DINGTALK_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return null;
  }
  return { clientId, clientSecret };
}

function ackCallback(client: DWClient, downstream: DingtalkBotMessageDownstream): void {
  client.socketCallBackResponse(downstream.headers.messageId, { status: 'SUCCESS' });
}

async function handleDingtalkMessage(
  client: DWClient,
  downstream: DingtalkBotMessageDownstream
): Promise<void> {
  try {
    await publishDingtalkInboundFromDownstream(downstream);
  } finally {
    ackCallback(client, downstream);
  }
}

/**
 * 启动钉钉 Stream 长连接；未配置 DINGTALK_CLIENT_ID/SECRET 时跳过。
 * handler 仅 normalize + publishInbound，不 await Harness。
 */
export function startDingtalkStreamListener(): void {
  const credentials = readDingtalkCredentials();
  if (!credentials) {
    linkStatus = 'skipped';
    console.info('[DINGTALK] 未配置 DINGTALK_CLIENT_ID/DINGTALK_CLIENT_SECRET，跳过钉钉 Stream');
    return;
  }

  if (streamClient) {
    console.warn('[DINGTALK] 钉钉 Stream 已启动，跳过重复初始化');
    return;
  }

  streamClient = new DWClient({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
  });

  streamClient.registerCallbackListener(TOPIC_ROBOT, (downstream: DingtalkBotMessageDownstream) => {
    void handleDingtalkMessage(streamClient as DWClient, downstream);
  });

  linkStatus = 'connecting';

  void streamClient
    .connect()
    .then(() => {
      linkStatus = 'connected';
      console.info('[DINGTALK] 钉钉 Stream 已连接');
    })
    .catch((error: unknown) => {
      linkStatus = 'disconnected';
      console.error('[DINGTALK] 钉钉 Stream 连接失败:', error);
    });

  console.info('[DINGTALK] 钉钉 Stream 已启动（/v1.0/im/bot/messages/get）');
}
