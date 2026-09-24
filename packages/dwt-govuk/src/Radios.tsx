import { ErrorMessage } from './ErrorMessage'

export function Radios({
  name,
  legend,
  error,
  value,
  onChange,
  options,
}: {
  name: string
  legend: string
  error?: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  const groupClass = error ? 'govuk-form-group govuk-form-group--error' : 'govuk-form-group'
  return (
    <div className={groupClass}>
      <fieldset className="govuk-fieldset">
        <legend className="govuk-fieldset__legend govuk-fieldset__legend--s">{legend}</legend>
        {error ? <ErrorMessage id={`${name}-error`}>{error}</ErrorMessage> : null}
        <div className="govuk-radios" data-module="govuk-radios">
          {options.map((option) => (
            <div className="govuk-radios__item" key={option.value}>
              <input
                className="govuk-radios__input"
                id={`${name}-${option.value}`}
                name={name}
                type="radio"
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
              />
              <label className="govuk-label govuk-radios__label" htmlFor={`${name}-${option.value}`}>
                {option.label}
              </label>
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
