/**
 * 压缩基线与消息历史本地持久化 — 对齐 compact-baseline-storage.js
 */

import type { ApiMessage } from './message-history-builder';
import {
  compactBaselineStorageKey,
  type CompactedBaselineStorage,
} from './storage-contract';

export interface CompactStorageContext {
  sessionId: string;
  compactedBaseline: CompactedBaselineStorage | null;
}

export interface CompactStorageDeps {
  isAuthed: () => boolean;
}

export function persistMessageHistoryGuest(
  deps: CompactStorageDeps,
  saveFn: () => void
): void {
  if (deps.isAuthed()) {
    return;
  }
  saveFn();
}

export function saveCompactedBaselineToStorage(
  ctx: CompactStorageContext,
  deps: CompactStorageDeps
): void {
  if (deps.isAuthed() || typeof window === 'undefined') {
    return;
  }
  if (!ctx.sessionId) {
    return;
  }
  const key = compactBaselineStorageKey(ctx.sessionId);
  if (ctx.compactedBaseline) {
    localStorage.setItem(key, JSON.stringify(ctx.compactedBaseline));
  } else {
    localStorage.removeItem(key);
  }
}

export function loadCompactedBaselineFromStorage(
  sessionId: string,
  deps: CompactStorageDeps
): CompactedBaselineStorage | null {
  if (deps.isAuthed() || typeof window === 'undefined' || !sessionId) {
    return null;
  }
  try {
    const raw = localStorage.getItem(compactBaselineStorageKey(sessionId));
    return raw ? (JSON.parse(raw) as CompactedBaselineStorage) : null;
  } catch {
    return null;
  }
}

export interface CompactConsumeMarker {
  userMessageIndex: number;
  hadOverride: boolean;
  summaryContent: string | null;
}

export function beginCompactConsumeTracking(
  messageHistoryLength: number,
  apiContextOverride: ApiMessage[] | null | undefined
): CompactConsumeMarker {
  const hadOverride = Boolean(apiContextOverride?.length);
  const overrideContent = hadOverride ? apiContextOverride?.[0]?.content : undefined;
  return {
    userMessageIndex: messageHistoryLength,
    hadOverride,
    summaryContent: typeof overrideContent === 'string' ? overrideContent : null,
  };
}

export function shouldConsumeAfterSuccessfulSend(
  userAborted: boolean,
  marker: CompactConsumeMarker | null,
  autoCompactSummaryFromStream: string | null
): boolean {
  if (userAborted) {
    return false;
  }
  if (marker?.hadOverride && marker.summaryContent) {
    return true;
  }
  return Boolean(autoCompactSummaryFromStream && marker);
}

export interface ConsumeCompactResult {
  compactedBaseline: CompactedBaselineStorage | null;
  shouldClearOverride: boolean;
}

export function consumeContextCompression(
  marker: CompactConsumeMarker | null,
  autoCompactSummaryFromStream: string | null
): ConsumeCompactResult {
  let summaryContent: string | null = null;
  let historyStartIndex: number | null = null;

  if (marker?.hadOverride && marker.summaryContent) {
    summaryContent = marker.summaryContent;
    historyStartIndex = marker.userMessageIndex;
  } else if (typeof autoCompactSummaryFromStream === 'string' && autoCompactSummaryFromStream.trim() && marker) {
    summaryContent = autoCompactSummaryFromStream;
    historyStartIndex = marker.userMessageIndex;
  }

  if (!summaryContent || historyStartIndex === null || historyStartIndex < 0) {
    return { compactedBaseline: null, shouldClearOverride: false };
  }

  return {
    compactedBaseline: { summaryContent, historyStartIndex },
    shouldClearOverride: true,
  };
}
