import { cn } from '@/lib/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'text';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'default' | 'sm';
  block?: boolean;
  isLoading?: boolean;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  text: 'btn-text',
};

export function Button({
  variant = 'primary',
  size = 'default',
  block = false,
  isLoading = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      className={cn(
        VARIANT_CLASS[variant],
        size === 'sm' && variant === 'text' && 'btn-text--sm',
        size === 'sm' && variant !== 'text' && 'btn-sm',
        block && 'btn-block',
        isLoading && 'is-loading',
        className,
      )}
      disabled={disabled ?? isLoading}
      {...props}
    >
      {children}
    </button>
  );
}
