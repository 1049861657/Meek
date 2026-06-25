export type StatusPillVariant = 'ok' | 'warn' | 'danger' | 'neutral';

export interface StatusPillProps {
  label: string;
  variant?: StatusPillVariant;
  className?: string;
}

export function StatusPill({
  label,
  variant = 'neutral',
  className,
}: StatusPillProps): React.ReactElement {
  return (
    <span
      className={`ui-status-pill ui-status-pill--${variant}${className ? ` ${className}` : ''}`}
      role="status"
    >
      {label}
    </span>
  );
}
