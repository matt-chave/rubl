import type { InputHTMLAttributes } from 'react'
import { ErrorMessage } from './ErrorMessage'

export function Input({
  id,
  label,
  hint,
  error,
  width,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string
  label: string
  hint?: string
  error?: string
  width?: '20' | '10' | '5' | '4' | '3' | '2'
}) {
  const groupClass = error ? 'govuk-form-group govuk-form-group--error' : 'govuk-form-group'
  const inputClass = `govuk-input${width ? ` govuk-input--width-${width}` : ''}${error ? ' govuk-input--error' : ''}`
  return (
    <div className={groupClass}>
      <label className="govuk-label" htmlFor={id}>
        {label}
      </label>
      {hint ? (
        <div id={`${id}-hint`} className="govuk-hint">
          {hint}
        </div>
      ) : null}
      {error ? <ErrorMessage id={`${id}-error`}>{error}</ErrorMessage> : null}
      <input
        id={id}
        className={inputClass}
        aria-describedby={[hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined}
        {...props}
      />
    </div>
  )
}
