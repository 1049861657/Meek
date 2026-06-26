const DINGTALK_MARKDOWN_TITLE_MAX = 50;

export interface DingtalkMarkdownOutbound {
  title: string;
  text: string;
}

function truncateTitle(title: string): string {
  if (title.length <= DINGTALK_MARKDOWN_TITLE_MAX) {
    return title;
  }
  return `${title.slice(0, DINGTALK_MARKDOWN_TITLE_MAX - 1)}…`;
}

/** 从 Markdown 正文提取 session 列表标题；无标题时用首行或「回复」 */
export function resolveDingtalkMarkdownTitle(text: string): string {
  const headingMatch = text.match(/^#{1,6}\s+(.+)$/m);
  if (headingMatch?.[1]) {
    return truncateTitle(headingMatch[1].trim());
  }

  const firstLine = text.split('\n').find((line) => line.trim().length > 0)?.trim();
  if (firstLine) {
    return truncateTitle(firstLine.replace(/^[-*>\s]+/, ''));
  }

  return '回复';
}

/** Harness 聚合文本 → 钉钉 markdown 出站 payload */
export function formatDingtalkMarkdownOutbound(rawText: string): DingtalkMarkdownOutbound {
  const text = rawText.trim();
  return {
    title: resolveDingtalkMarkdownTitle(text),
    text,
  };
}
