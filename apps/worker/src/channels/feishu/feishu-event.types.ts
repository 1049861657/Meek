/** 飞书 im.message.receive_v1 事件体（SDK WSClient handler 入参） */
export interface FeishuReceiveMessageEvent {
  event_id?: string;
  sender: {
    sender_id?: {
      union_id?: string;
      user_id?: string;
      open_id?: string;
    };
    sender_type: string;
    tenant_key?: string;
  };
  message: {
    message_id: string;
    chat_id: string;
    chat_type: string;
    message_type: string;
    content: string;
    mentions?: Array<{
      key: string;
      id: {
        union_id?: string;
        user_id?: string;
        open_id?: string;
      };
      mentioned_type?: string;
      name: string;
      tenant_key?: string;
    }>;
  };
}
