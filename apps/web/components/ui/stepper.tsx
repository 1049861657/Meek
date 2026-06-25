'use client';

import { cn } from '@/lib/utils/cn';

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  className?: string;
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  className,
}: StepperProps): React.ReactElement {
  const apply = (next: number): void => {
    const clamped = Math.min(max, Math.max(min, next));
    onChange(clamped);
  };

  return (
    <div className={cn('ui-stepper', className)}>
      <button
        type="button"
        className="ui-stepper-btn"
        aria-label="减少"
        disabled={value <= min}
        onClick={() => apply(value - step)}
      >
        −
      </button>
      <span className="ui-stepper-value" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className="ui-stepper-btn"
        aria-label="增加"
        disabled={value >= max}
        onClick={() => apply(value + step)}
      >
        +
      </button>
    </div>
  );
}
