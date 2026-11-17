// Input.tsx - 앱 공통 텍스트 입력
// label/hint/error/좌측 아이콘/우측 슬롯을 내장해 화면마다 다른 인풋 래퍼를 만들지 않게 한다.
import React from 'react';
import type { UiSize } from './Button.tsx';

export interface FieldMessageProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
}

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>, FieldMessageProps {
  size?: UiSize;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hint,
      error,
      size = 'md',
      leftIcon,
      rightSlot,
      className,
      containerClassName,
      id,
      ...rest
    },
    ref
  ) => {
    const autoId = React.useId();
    const inputId = id || `ui-input-${autoId}`;
    const describedBy = error || hint ? `${inputId}-desc` : undefined;

    return (
      <div className={`ui-field ${containerClassName || ''}`.trim()}>
        {label && (
          <label className="ui-field__label" htmlFor={inputId}>
            {label}
          </label>
        )}
        <div
          className={`ui-input-wrap ui-input-wrap--${size} ${leftIcon ? 'has-left-icon' : ''} ${
            rightSlot ? 'has-right-slot' : ''
          } ${error ? 'is-invalid' : ''}`}
        >
          {leftIcon && <span className="ui-input-wrap__icon">{leftIcon}</span>}
          <input
            ref={ref}
            id={inputId}
            className={`ui-input ${className || ''}`.trim()}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            {...rest}
          />
          {rightSlot && <span className="ui-input-wrap__right">{rightSlot}</span>}
        </div>
        {(error || hint) && (
          <p
            id={`${inputId}-desc`}
            className={`ui-field__message ${error ? 'is-error' : ''}`}
            role={error ? 'alert' : undefined}
          >
            {error || hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
