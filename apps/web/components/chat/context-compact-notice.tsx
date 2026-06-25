'use client';

interface ContextCompactNoticeProps {
  label?: string;
}

/** 上下文压缩横幅 — 对齐 chat-shell-ui addContextNotice */
export function ContextCompactNotice({
  label = '已压缩',
}: ContextCompactNoticeProps): React.ReactElement {
  return (
    <div className="chat-context-notice chat-context-notice-compacted" role="status">
      <span className="chat-context-notice-text">{label}</span>
    </div>
  );
}
