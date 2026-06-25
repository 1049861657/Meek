'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';

export interface FloatingTooltipProps {
  message: string;
  durationMs?: number;
  className?: string;
}

export function FloatingTooltipHost({
  className,
}: {
  className?: string;
}): React.ReactElement {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    registerFloatingTooltipHost((nextMessage, durationMs) => {
      setMessage(nextMessage);
      setVisible(true);
      window.setTimeout(() => setVisible(false), durationMs);
    });
    return () => registerFloatingTooltipHost(null);
  }, []);

  return (
    <div className={cn('ui-tooltip-host', className)} aria-live="polite">
      <div className={cn('ui-tooltip', visible && 'show')}>{message}</div>
    </div>
  );
}

type TooltipHostHandler = (message: string, durationMs: number) => void;

let tooltipHostHandler: TooltipHostHandler | null = null;

function registerFloatingTooltipHost(handler: TooltipHostHandler | null): void {
  tooltipHostHandler = handler;
}

export function showFloatingTooltip(
  message: string,
  durationMs = 2000,
): void {
  if (!tooltipHostHandler) {
    return;
  }
  tooltipHostHandler(message, durationMs);
}
