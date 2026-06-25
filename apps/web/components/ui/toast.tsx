'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';

const DEFAULT_DURATION_MS = 3200;

export type ToastVariant = 'info' | 'success' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  durationMs: number;
}

function toastVariantClass(variant: ToastVariant): string {
  if (variant === 'success') {
    return 'fb-toast--success';
  }
  if (variant === 'error') {
    return 'fb-toast--error';
  }
  return 'fb-toast--info';
}

const CHECK_ICON = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    fill="currentColor"
    className="size-4"
    aria-hidden="true"
  >
    <path d="M13.485 3.515a1 1 0 0 1 0 1.414l-7.07 7.071-3.536-3.536a1 1 0 1 1 1.414-1.415l2.122 2.122 6.364-6.364a1 1 0 0 1 1.414 0z" />
  </svg>
);

const CLOSE_ICON = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="size-4"
    aria-hidden="true"
  >
    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22z" />
  </svg>
);

type ToastPushHandler = (message: string, variant: ToastVariant, durationMs: number) => void;

let toastPushHandler: ToastPushHandler | null = null;

function registerToastHost(handler: ToastPushHandler | null): void {
  toastPushHandler = handler;
}

export function showToast(
  message: string,
  variant: ToastVariant = 'info',
  durationMs = DEFAULT_DURATION_MS,
): void {
  if (!toastPushHandler) {
    return;
  }
  toastPushHandler(message, variant, durationMs);
}

function ToastItemView({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}): React.ReactElement {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(item.id), item.durationMs);
    return () => window.clearTimeout(timer);
  }, [item.id, item.durationMs, onDismiss]);

  return (
    <div
      id={item.id}
      className={cn('fb-toast', toastVariantClass(item.variant))}
      role="alert"
    >
      {item.variant === 'success' ? (
        <span className="shrink-0 text-green-600">{CHECK_ICON}</span>
      ) : null}
      <div className="fb-toast__message">{item.message}</div>
      <button
        type="button"
        className="fb-toast__close"
        aria-label="关闭"
        onClick={() => onDismiss(item.id)}
      >
        {CLOSE_ICON}
      </button>
    </div>
  );
}

export function ToastHost(): React.ReactElement | null {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    registerToastHost((message, variant, durationMs) => {
      const id = `shared-toast-${Math.random().toString(36).slice(2, 9)}`;
      setToasts((prev) => [...prev, { id, message, variant, durationMs }]);
    });
    return () => registerToastHost(null);
  }, [dismiss]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div id="shared-toast-container" className="fb-toast-stack" aria-live="polite">
      {toasts.map((item) => (
        <ToastItemView key={item.id} item={item} onDismiss={dismiss} />
      ))}
    </div>
  );
}
