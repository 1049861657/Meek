'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { FieldInput } from '@/components/ui/form-field';
import { enqueueInputDialog } from '@/components/ui/confirm-dialog';

export interface InputDialogOptions {
  title: string;
  message?: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  inputType?: 'text' | 'password';
}

export interface InputDialogProps extends InputDialogOptions {
  open: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function InputDialog({
  open,
  title,
  message = '',
  label = '',
  defaultValue = '',
  placeholder = '',
  confirmLabel = '确认',
  cancelLabel = '取消',
  inputType = 'text',
  onConfirm,
  onCancel,
}: InputDialogProps): React.ReactElement | null {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = 'shared-input-field';

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', onKeydown);
    const input = inputRef.current;
    input?.focus();
    input?.select();
    return () => document.removeEventListener('keydown', onKeydown);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  const confirm = (): void => {
    onConfirm(inputRef.current?.value ?? '');
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[119] bg-slate-900/42 backdrop-blur-[3px]"
        aria-hidden="true"
        onClick={onCancel}
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
              <div className="fb-confirm-field">
                {label ? (
                  <label
                    className="ui-field-label ui-field-label--spaced"
                    htmlFor={inputId}
                  >
                    {label}
                  </label>
                ) : null}
                <FieldInput
                  ref={inputRef}
                  id={inputId}
                  type={inputType}
                  defaultValue={defaultValue}
                  placeholder={placeholder}
                  autoComplete="off"
                  data-role="input"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      confirm();
                    }
                  }}
                />
              </div>
            </div>
            <div className="fb-confirm-actions">
              <Button variant="secondary" data-role="cancel" onClick={onCancel}>
                {cancelLabel}
              </Button>
              <Button variant="primary" data-role="confirm" onClick={confirm}>
                {confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function inputDialog(options: InputDialogOptions): Promise<string | null> {
  return enqueueInputDialog(options);
}
