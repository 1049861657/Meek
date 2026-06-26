import * as Lark from '@larksuiteoapi/node-sdk';

import { publishFeishuInboundFromEvent } from '../publish-im-inbound.js';
import type { FeishuReceiveMessageEvent } from './feishu-event.types.js';
import { getFeishuClient, initFeishuClient, resolveFeishuDomain } from './feishu-sdk.js';

export type FeishuLinkStatus = 'connected' | 'disconnected' | 'skipped';

let wsClient: Lark.WSClient | null = null;
let linkStatus: FeishuLinkStatus = 'skipped';

export function getFeishuLinkStatus(): FeishuLinkStatus {
  return linkStatus;
}

function readFeishuCredentials(): { appId: string; appSecret: string } | null {
  const appId = process.env.FEISHU_APP_ID?.trim();
  const appSecret = process.env.FEISHU_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    return null;
  }
  return { appId, appSecret };
}

/**
 * 启动飞书 WSClient 长连接；未配置 FEISHU_APP_ID/SECRET 时跳过。
 * handler 仅 normalize + publishInbound，不 await Harness。
 */
export function startFeishuEventListener(): void {
  const credentials = readFeishuCredentials();
  if (!credentials) {
    linkStatus = 'skipped';
    console.info('[FEISHU] 未配置 FEISHU_APP_ID/FEISHU_APP_SECRET，跳过飞书长连接');
    return;
  }

  if (wsClient) {
    console.warn('[FEISHU] 飞书长连接已启动，跳过重复初始化');
    return;
  }

  const domain = resolveFeishuDomain();
  initFeishuClient({ ...credentials, domain });
  getFeishuClient();

  wsClient = new Lark.WSClient({
    appId: credentials.appId,
    appSecret: credentials.appSecret,
    domain,
  });

  try {
    wsClient.start({
      eventDispatcher: new Lark.EventDispatcher({}).register({
        'im.message.receive_v1': (data: FeishuReceiveMessageEvent) => {
          void publishFeishuInboundFromEvent(data);
        },
      }),
    });
    linkStatus = 'connected';
    console.info('[FEISHU] 飞书长连接已启动（im.message.receive_v1）');
  } catch (error: unknown) {
    linkStatus = 'disconnected';
    console.error('[FEISHU] 飞书长连接启动失败:', error);
  }
}
