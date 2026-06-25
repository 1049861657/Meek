'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMarkdownInnerProps {
  content: string;
  className?: string;
}

export function ChatMarkdownInner({
  content,
  className,
}: ChatMarkdownInnerProps): React.ReactElement {
  return (
    <div className={`chat-markdown ${className ?? ''}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
