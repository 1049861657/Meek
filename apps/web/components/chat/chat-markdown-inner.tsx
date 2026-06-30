'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMarkdownInnerProps {
  content: string;
  className?: string;
  bare?: boolean;
}

export function ChatMarkdownInner({
  content,
  className,
  bare = false,
}: ChatMarkdownInnerProps): React.ReactElement {
  const markdown = <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>;
  if (bare) {
    return markdown;
  }
  return <div className={(className || 'markdown-content').trim()}>{markdown}</div>;
}
