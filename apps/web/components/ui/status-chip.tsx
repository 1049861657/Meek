export type StatusChipVariant = 'ok' | 'off' | 'pending' | 'warn' | 'danger';

export function normalizeStatusChipVariant(
  variant: StatusChipVariant | 'on' | 'err',
): StatusChipVariant {
  if (variant === 'on') {
    return 'ok';
  }
  if (variant === 'err') {
    return 'danger';
  }
  if (
    variant === 'ok' ||
    variant === 'off' ||
    variant === 'pending' ||
    variant === 'warn' ||
    variant === 'danger'
  ) {
    return variant;
  }
  return 'off';
}

export interface StatusChipProps {
  label: string;
  variant?: StatusChipVariant | 'on' | 'err';
  className?: string;
}

export function StatusChip({
  label,
  variant = 'off',
  className,
}: StatusChipProps): React.ReactElement {
  const normalized = normalizeStatusChipVariant(variant);
  return (
    <span
      className={`ui-status-chip ui-status-chip--${normalized}${className ? ` ${className}` : ''}`}
      role="status"
    >
      <span className="ui-status-chip__dot" aria-hidden="true" />
      <span className="ui-status-chip__label">{label}</span>
    </span>
  );
}
