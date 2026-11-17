// Textarea.tsx - 앱 공통 여러 줄 입력
import React from 'react';
import type { FieldMessageProps, InputProps } from './Input.tsx';

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'>,
    FieldMessageProps {
  containerClassName?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className, containerClassName, id, rows = 3, ...rest }, ref) => {
    const autoId = React.useId();
    const fieldId = id || `ui-textarea-${autoId}`;
    const describedBy = error || hint ? `${fieldId}-desc` : undefined;

    return (
      <div className={`ui-field ${containerClassName || ''}`.trim()}>
        {label && (
          <label className="ui-field__label" htmlFor={fieldId}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={fieldId}
          rows={rows}
          className={`ui-textarea ${error ? 'is-invalid' : ''} ${className || ''}`.trim()}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {(error || hint) && (
          <p
            id={`${fieldId}-desc`}
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

Textarea.displayName = 'Textarea';

export type { InputProps };
