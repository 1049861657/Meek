import { ChatPanel } from '@/components/chat/chat-panel';

import './chat.css';

/** RSC 壳：SSE/交互在 ChatPanel Client 子树（M3-00-04） */
export default function AiPage(): React.ReactElement {
  return (
    <main className="chat-page">
      <ChatPanel />
    </main>
  );
}
