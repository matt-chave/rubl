import type { SelectHTMLAttributes } from 'react'
import { ErrorMessage } from './ErrorMessage'

export function Select({
  id,
  label,
  hint,
  error,
  options,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  id: string
  label: string
  hint?: string
  error?: string
  options: { value: string; label: string }[]
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
      <select id={id} className={`govuk-select${error ? ' govuk-select--error' : ''}`} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
