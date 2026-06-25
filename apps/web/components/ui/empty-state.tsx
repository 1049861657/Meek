export type EmptyStateVariant =
  | 'default'
  | 'inline'
  | 'dashed'
  | 'error'
  | 'compact'
  | 'panel';

export interface EmptyStateProps {
  message: string;
  title?: string;
  variant?: EmptyStateVariant;
  className?: string;
}

export function EmptyState({
  message,
  title = '',
  variant = 'default',
  className = '',
}: EmptyStateProps): React.ReactElement {
  const baseClass = ['ui-empty-state', `ui-empty-state--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  if (
    variant === 'inline' ||
    variant === 'error' ||
    variant === 'dashed' ||
    variant === 'compact'
  ) {
    return (
      <p className={baseClass} role="status">
        {message}
      </p>
    );
  }

  return (
    <div className={baseClass} role="status">
      {title ? <h3 className="ui-empty-state__title">{title}</h3> : null}
      <p className="ui-empty-state__message">{message}</p>
    </div>
  );
}
