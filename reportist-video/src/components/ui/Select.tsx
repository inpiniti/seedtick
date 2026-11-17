// Select.tsx - 앱 공통 셀렉트
import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { FieldMessageProps } from './Input.tsx';
import type { UiSize } from './Button.tsx';

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
    FieldMessageProps {
  size?: UiSize;
  containerClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, size = 'md', className, containerClassName, id, children, ...rest }, ref) => {
    const autoId = React.useId();
    const selectId = id || `ui-select-${autoId}`;
    const describedBy = error || hint ? `${selectId}-desc` : undefined;

    return (
      <div className={`ui-field ${containerClassName || ''}`.trim()}>
        {label && (
          <label className="ui-field__label" htmlFor={selectId}>
            {label}
          </label>
        )}
        <div className={`ui-select-wrap ui-input-wrap--${size} ${error ? 'is-invalid' : ''}`}>
          <select
            ref={ref}
            id={selectId}
            className={`ui-select ${className || ''}`.trim()}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            {...rest}
          >
            {children}
          </select>
          <ChevronDown size={14} className="ui-select__chevron" aria-hidden="true" />
        </div>
        {(error || hint) && (
          <p
            id={`${selectId}-desc`}
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

Select.displayName = 'Select';
