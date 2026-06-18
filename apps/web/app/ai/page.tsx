import { ChatPanel } from '@/components/chat/chat-panel';

import './chat.css';

export default function AiPage(): React.ReactElement {
  return (
    <main className="chat-page">
      <ChatPanel />
    </main>
  );
}
