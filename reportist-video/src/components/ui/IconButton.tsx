// IconButton.tsx - 정사각/원형 아이콘 전용 버튼
// 라벨이 없는 아이콘 버튼은 aria-label을 필수로 받아 접근성을 보장한다.
import React from 'react';
import type { ButtonVariant, UiSize } from './Button.tsx';

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> {
  /** 스크린 리더용 필수 라벨 */
  label: string;
  variant?: ButtonVariant;
  size?: UiSize;
  shape?: 'square' | 'circle';
  children: React.ReactNode;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      label,
      variant = 'secondary',
      size = 'sm',
      shape = 'square',
      className,
      type = 'button',
      children,
      ...rest
    },
    ref
  ) => {
    const classes = [
      'ui-icon-btn',
      `ui-icon-btn--${variant}`,
      `ui-icon-btn--${size}`,
      `ui-icon-btn--${shape}`,
      className || '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        aria-label={label}
        title={rest.title || label}
        {...rest}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
