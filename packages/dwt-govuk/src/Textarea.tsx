import type { TextareaHTMLAttributes } from 'react'
import { ErrorMessage } from './ErrorMessage'

export function Textarea({
  id,
  label,
  hint,
  error,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string
  label: string
  hint?: string
  error?: string
}) {
  const groupClass = error ? 'govuk-form-group govuk-form-group--error' : 'govuk-form-group'
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
      <textarea id={id} className={`govuk-textarea${error ? ' govuk-textarea--error' : ''}`} rows={5} {...props} />
    </div>
  )
}
