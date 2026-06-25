import type { StatusChipVariant } from '@/components/ui/status-chip';
import { normalizeStatusChipVariant } from '@/components/ui/status-chip';

export type StatusDotVariant = StatusChipVariant;

export interface StatusDotProps {
  variant?: StatusDotVariant | 'on' | 'err';
  className?: string;
}

export function StatusDot({
  variant = 'off',
  className,
}: StatusDotProps): React.ReactElement {
  const normalized = normalizeStatusChipVariant(variant);
  return (
    <span
      className={`ui-status-dot ui-status-dot--${normalized}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    />
  );
}
