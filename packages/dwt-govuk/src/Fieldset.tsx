import type { ReactNode } from 'react'

export function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="govuk-fieldset">
      <legend className="govuk-fieldset__legend govuk-fieldset__legend--m">
        <h2 className="govuk-fieldset__heading">{legend}</h2>
      </legend>
      {children}
    </fieldset>
  )
}
