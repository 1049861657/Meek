/** Stream 回调 `/v1.0/im/bot/messages/get` 下行帧（M5-05 接入 dingtalk-stream 后对齐 SDK 类型） */
export interface DingtalkBotMessageDownstream {
  data: string;
}

/** 机器人文本消息体（data JSON 解析后） */
export interface DingtalkBotTextMessage {
  msgtype: string;
  msgId?: string;
  senderId?: string;
  chatbotUserId?: string;
  conversationId: string;
  conversationType?: string;
  sessionWebhook?: string;
  sessionWebhookExpiredTime?: number;
  robotCode?: string;
  isInAtList?: boolean;
  conversationTitle?: string;
  text?: {
    content?: string;
  };
}
