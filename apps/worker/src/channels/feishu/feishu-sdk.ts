import * as Lark from '@larksuiteoapi/node-sdk';

let feishuClient: Lark.Client | null = null;

export interface FeishuSdkInitConfig {
  appId: string;
  appSecret: string;
  domain: Lark.Domain;
}

/** 初始化飞书 SDK Client（reply API 与 WS 共用凭证） */
export function initFeishuClient(config: FeishuSdkInitConfig): Lark.Client {
  feishuClient = new Lark.Client({
    appId: config.appId,
    appSecret: config.appSecret,
    domain: config.domain,
  });
  return feishuClient;
}

/** 获取已初始化的飞书 Client */
export function getFeishuClient(): Lark.Client {
  if (!feishuClient) {
    throw new Error('飞书 Client 未初始化');
  }
  return feishuClient;
}

export function resolveFeishuDomain(): Lark.Domain {
  return process.env.FEISHU_DOMAIN === 'lark' ? Lark.Domain.Lark : Lark.Domain.Feishu;
}
