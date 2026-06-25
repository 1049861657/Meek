'use client';

import { useEffect } from 'react';
import { showToast } from '@/components/ui/toast';

export interface AuthShellProps {
  isGuest: boolean;
  onRequireAuth: () => void;
}

export function AuthShell({ isGuest, onRequireAuth }: AuthShellProps): null {
  useEffect(() => {
    const onClick = (event: MouseEvent): void => {
      if (!isGuest) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const authControl = target.closest('[data-requires-auth]');
      if (!authControl) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      showToast('请先登录后再操作', 'info');
      onRequireAuth();
    };

    const onSubmit = (event: Event): void => {
      if (!isGuest) {
        return;
      }
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.hasAttribute('data-requires-auth')) {
        return;
      }
      event.preventDefault();
      showToast('请先登录后再操作', 'info');
      onRequireAuth();
    };

    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
    };
  }, [isGuest, onRequireAuth]);

  return null;
}

export function applyAuthDocumentState(user: { id: string } | null): void {
  document.documentElement.dataset.auth = user ? 'authenticated' : 'guest';
}
