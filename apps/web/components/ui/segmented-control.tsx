'use client';

import { cn } from '@/lib/utils/cn';

export interface SegmentedOption {
  value: string;
  label: string;
  disabled?: boolean;
  title?: string;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  buttonClassName?: string;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  buttonClassName,
}: SegmentedControlProps): React.ReactElement {
  return (
    <div className={cn('ui-segmented', className)} role="group">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            'ui-seg-btn',
            buttonClassName,
            value === option.value && 'active',
            option.disabled && 'is-disabled',
          )}
          title={option.title}
          disabled={option.disabled}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
