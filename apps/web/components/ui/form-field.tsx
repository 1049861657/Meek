import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  error?: string;
  spacedLabel?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  htmlFor,
  error,
  spacedLabel = false,
  className,
  children,
}: FormFieldProps): React.ReactElement {
  return (
    <div className={cn('ui-field-row', className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className={cn('ui-field-label', spacedLabel && 'ui-field-label--spaced')}
        >
          {label}
        </label>
      ) : null}
      {children}
      {error ? <p className="ui-field-error">{error}</p> : null}
    </div>
  );
}

export interface FieldInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  textarea?: false;
}

export interface FieldTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  textarea: true;
}

export type FieldControlProps = FieldInputProps | FieldTextareaProps;

export const FieldInput = forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  FieldControlProps
>(function FieldInput({ textarea, className, ...props }, ref) {
  if (textarea) {
    const { textarea: _textarea, ...textareaProps } = props as FieldTextareaProps;
    return (
      <textarea
        ref={ref as React.Ref<HTMLTextAreaElement>}
        className={cn('ui-field-input ui-field-input--textarea', className)}
        {...textareaProps}
      />
    );
  }

  return (
    <input
      ref={ref as React.Ref<HTMLInputElement>}
      className={cn('ui-field-input', className)}
      {...(props as FieldInputProps)}
    />
  );
});

export function FieldRow({
  columns = 1,
  className,
  children,
}: {
  columns?: 1 | 2;
  className?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      className={cn('ui-field-row', columns === 2 && 'ui-field-row--2', className)}
    >
      {children}
    </div>
  );
}
