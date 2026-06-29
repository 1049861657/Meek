'use client';

import { useCallback, useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface OverlayModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  modalId?: string;
  className?: string;
  panelClassName?: string;
  wide?: boolean;
  /** 为 true 时不套用通用 ui-modal-panel，仅使用 panelClassName（聊天专用模态） */
  customPanel?: boolean;
  closeOnBackdrop?: boolean;
}

export function OverlayModal({
  open,
  onClose,
  children,
  modalId,
  className,
  panelClassName,
  wide = false,
  customPanel = false,
  closeOnBackdrop = true,
}: OverlayModalProps): React.ReactElement | null {
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (closeOnBackdrop && event.target === event.currentTarget) {
        onClose();
      }
    },
    [closeOnBackdrop, onClose],
  );

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

  return (
    <div
      id={modalId}
      className={cn('ui-modal', className)}
      aria-hidden="false"
      onClick={handleBackdropClick}
    >
      <div
        className={cn(
          !customPanel && 'ui-modal-panel',
          !customPanel && wide && 'ui-modal-panel--wide',
          panelClassName,
        )}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}

export interface OverlayModalHeaderProps {
  title: string;
  onClose?: () => void;
  closeLabel?: string;
}

export function OverlayModalHeader({
  title,
  onClose,
  closeLabel = '关闭',
}: OverlayModalHeaderProps): React.ReactElement {
  return (
    <div className="ui-modal-header">
      <h2 className="ui-modal-title">{title}</h2>
      {onClose ? (
        <button
          type="button"
          className="ui-modal-close chat-modal-close"
          aria-label={closeLabel}
          data-close-modal
          onClick={onClose}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export function OverlayModalBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.ReactElement {
  return <div className={cn('ui-modal-body', className)}>{children}</div>;
}

export function OverlayModalFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.ReactElement {
  return <div className={cn('ui-modal-footer', className)}>{children}</div>;
}
