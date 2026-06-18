const SESSION_STORAGE_KEY = 'meek.webChatSessionId';

export function getOrCreateWebChatSessionId(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (existing && existing.trim().length > 0) {
    return existing.trim();
  }
  const id = crypto.randomUUID();
  sessionStorage.setItem(SESSION_STORAGE_KEY, id);
  return id;
}
