'use client';

import { useEffect } from 'react';
import { LoginForm } from '@/components/auth/login-form';

export interface AuthModalOptions {
  lead?: string;
  initialUsername?: string;
  onSuccess?: () => void;
}

export interface AuthModalProps extends AuthModalOptions {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({
  open,
  onClose,
  lead,
  initialUsername,
  onSuccess,
}: AuthModalProps): React.ReactElement | null {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const handleSuccess = (): void => {
    onClose();
    if (onSuccess) {
      onSuccess();
    } else {
      window.location.reload();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-[min(100%,380px)] rounded-[18px] bg-white p-7 pb-6 shadow-[0_24px_60px_rgb(15_23_42/0.22)]">
        <button
          type="button"
          className="absolute right-3.5 top-3.5 inline-flex h-[30px] w-[30px] items-center justify-center rounded-full bg-transparent text-[20px] leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="关闭"
          onClick={onClose}
        >
          ×
        </button>
        <LoginForm
          lead={lead}
          initialUsername={initialUsername}
          onSuccess={handleSuccess}
        />
      </div>
    </div>
  );
}
