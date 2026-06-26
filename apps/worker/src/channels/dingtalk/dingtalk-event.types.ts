import type { DWClientDownStream, RobotTextMessage } from 'dingtalk-stream';

/** Stream 回调 `/v1.0/im/bot/messages/get` 下行帧 */
export type DingtalkBotMessageDownstream = DWClientDownStream;

/** 机器人文本消息体（data JSON 解析后；SDK 类型未含 isInAtList） */
export interface DingtalkBotTextMessage extends RobotTextMessage {
  isInAtList?: boolean;
  conversationTitle?: string;
}