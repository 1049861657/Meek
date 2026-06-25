'use client';

import { cn } from '@/lib/utils/cn';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  id,
  className,
  'aria-label': ariaLabel,
}: ToggleProps): React.ReactElement {
  return (
    <label className={cn('ui-toggle-switch', className)}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="ui-toggle-switch__track" aria-hidden="true" />
    </label>
  );
}

export function ToggleButton({
  checked,
  onChange,
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: ToggleProps): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn('ui-toggle', checked && 'on', checked && 'is-on', className)}
      onClick={() => onChange(!checked)}
    />
  );
}
