'use client';

import dynamic from 'next/dynamic';

const ChatMarkdownInner = dynamic(
  () => import('./chat-markdown-inner').then((mod) => mod.ChatMarkdownInner),
  {
    loading: () => <span className="chat-markdown chat-markdown--loading">渲染中…</span>,
    ssr: false,
  }
);

interface ChatMarkdownProps {
  content: string;
  className?: string;
}

/** Markdown lazy 渲染 — 对齐 markdown-stack.js warm + parse */
export function ChatMarkdown({ content, className }: ChatMarkdownProps): React.ReactElement {
  if (!content.trim()) {
    return <></>;
  }
  return <ChatMarkdownInner content={content} className={className} />;
}
