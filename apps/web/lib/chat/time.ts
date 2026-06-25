/**
 * 聊天 UI 时间格式化（无 DOM 依赖部分）— 对齐 time.js
 */

export function getTimeString(): string {
  const now = new Date();
  return now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function getFullTimeString(): string {
  const now = new Date();
  return now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function calculateElapsedTime(startTime: number): number {
  return Date.now() - startTime;
}

export function formatElapsedTime(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}毫秒`;
  }
  const seconds = (milliseconds / 1000).toFixed(2);
  return `${seconds}秒`;
}

export function formatMemoryMentionedAt(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatElapsedSecondsLabel(timeInSeconds: number | undefined): string {
  if (timeInSeconds === undefined) {
    return '0秒';
  }
  const seconds = parseFloat(String(timeInSeconds));
  return Number.isNaN(seconds) ? '0秒' : `${seconds}秒`;
}

export function formatMessageTimeWithElapsed(
  elapsedSeconds: number | undefined
): string {
  return `${getFullTimeString()} · ${formatElapsedSecondsLabel(elapsedSeconds)}`;
}
