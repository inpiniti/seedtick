// Button.tsx - 앱 공통 버튼 프리미티브
// variant(색 역할) x size(높이/폰트 스케일) 조합만 사용하고, 화면별 padding/height 직접 지정은 금지한다.
import React from 'react';

export type UiSize = 'xs' | 'sm' | 'md' | 'lg';
export type ButtonVariant =
  | 'primary'
  | 'accent'
  | 'secondary'
  | 'subtle'
  | 'ghost'
  | 'danger';

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: UiSize;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      leftIcon,
      rightIcon,
      className,
      disabled,
      type = 'button',
      children,
      ...rest
    },
    ref
  ) => {
    const classes = [
      'ui-btn',
      `ui-btn--${variant}`,
      `ui-btn--${size}`,
      fullWidth ? 'ui-btn--block' : '',
      loading ? 'is-loading' : '',
      className || '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading ? <span className="ui-btn__spinner" aria-hidden="true" /> : leftIcon}
        <span className="ui-btn__label">{children}</span>
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
