import type { Metadata } from 'next';
import { ChatPanel } from '@/components/chat/chat-panel';

import './chat.css';

export const metadata: Metadata = {
  title: '聊天',
};

/** RSC 壳：SSE/交互在 ChatPanel Client 子树（M3-00-04） */
export default function ChatPage(): React.ReactElement {
  return (
    <main className="chat-page">
      <ChatPanel />
    </main>
  );
}
