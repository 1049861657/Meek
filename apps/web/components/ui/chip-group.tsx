'use client';

import { cn } from '@/lib/utils/cn';

export interface ChipOption {
  value: string;
  label: string;
}

export interface ChipGroupProps {
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ChipGroup({
  options,
  value,
  onChange,
  className,
}: ChipGroupProps): React.ReactElement {
  return (
    <div className={cn('ui-chip-group', className)} role="group">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn('ui-chip', value === option.value && 'active')}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
