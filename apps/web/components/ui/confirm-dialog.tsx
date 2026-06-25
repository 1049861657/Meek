'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

export interface ConfirmDialogOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  showCancel?: boolean;
}

export interface ConfirmDialogProps extends ConfirmDialogOptions {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message = '',
  confirmLabel = '确认',
  cancelLabel = '取消',
  variant = 'default',
  showCancel = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.ReactElement | null {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showCancel) {
        onCancel();
      }
    };
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  }, [open, onCancel, showCancel]);

  if (!open) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[119] bg-slate-900/42 backdrop-blur-[3px]"
        aria-hidden="true"
        onClick={showCancel ? onCancel : undefined}
      />
      <div
        className="fb-confirm-shell fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto p-4"
        aria-hidden="false"
        role="dialog"
        aria-modal="true"
      >
        <div className="mx-auto w-full max-w-md">
          <div className="fb-confirm-card">
            <div className="fb-confirm-body">
              <h2 className="fb-confirm-title m-0">{title}</h2>
              {message ? <p className="fb-confirm-message m-0">{message}</p> : null}
            </div>
            <div
              className={cn(
                'fb-confirm-actions',
                !showCancel && 'fb-confirm-actions--single',
              )}
            >
              {showCancel ? (
                <Button variant="secondary" data-role="cancel" autoFocus onClick={onCancel}>
                  {cancelLabel}
                </Button>
              ) : null}
              <Button
                variant={variant === 'danger' ? 'danger' : 'primary'}
                data-role="confirm"
                autoFocus={!showCancel}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export type DialogRequest =
  | {
      type: 'confirm';
      options: ConfirmDialogOptions;
      resolve: (value: boolean) => void;
    }
  | {
      type: 'input';
      options: import('@/components/ui/input-dialog').InputDialogOptions;
      resolve: (value: string | null) => void;
    };

type DialogEnqueueHandler = (request: DialogRequest) => void;

let dialogEnqueueHandler: DialogEnqueueHandler | null = null;

export function registerDialogHost(handler: DialogEnqueueHandler | null): void {
  dialogEnqueueHandler = handler;
}

export function confirmModal(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!dialogEnqueueHandler) {
      resolve(false);
      return;
    }
    dialogEnqueueHandler({ type: 'confirm', options, resolve });
  });
}

export function enqueueInputDialog(
  options: import('@/components/ui/input-dialog').InputDialogOptions,
): Promise<string | null> {
  return new Promise((resolve) => {
    if (!dialogEnqueueHandler) {
      resolve(null);
      return;
    }
    dialogEnqueueHandler({ type: 'input', options, resolve });
  });
}
