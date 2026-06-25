import { cn } from '@/lib/utils/cn';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}

const SIZE_CLASS: Record<SpinnerSize, string> = {
  sm: 'ui-spinner--sm',
  md: 'ui-spinner--md',
  lg: 'ui-spinner--lg',
};

export function Spinner({
  size = 'md',
  className,
  label,
}: SpinnerProps): React.ReactElement {
  const spinner = (
    <div
      className={cn('ui-spinner', SIZE_CLASS[size], className)}
      aria-hidden={label ? undefined : true}
      role={label ? 'status' : undefined}
    />
  );

  if (!label) {
    return spinner;
  }

  return (
    <div className="ui-spinner-block">
      {spinner}
      <span>{label}</span>
    </div>
  );
}
