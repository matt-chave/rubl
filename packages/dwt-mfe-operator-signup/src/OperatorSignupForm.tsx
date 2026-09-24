import { useState } from 'react'
import { Button, ErrorSummary, Fieldset, Input, Textarea } from '@dwt/govuk'
import { EMPTY_OPERATOR, type OperatorSignup } from './types'
import { assembleOperatorBody, validateOperatorSlice } from './validate'

export function OperatorSignupForm({
  value,
  onChange,
  onSubmit,
}: {
  value?: OperatorSignup
  onChange: (next: OperatorSignup) => void
  onSubmit?: (body: {
    organisationName: string
    address: string
    contactEmail: string
  }) => void
}) {
  const draft: OperatorSignup = { ...EMPTY_OPERATOR, ...value }
  const [errors, setErrors] = useState<{ id: string; message: string }[]>([])

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const next = validateOperatorSlice(draft)
        setErrors(next)
        if (next.length === 0) {
          onSubmit?.(assembleOperatorBody(draft))
        }
      }}
    >
      <ErrorSummary errors={errors} />
      <Fieldset legend="Waste operator details">
        <Input
          id="organisationName"
          label="Organisation name"
          value={draft.organisationName ?? ''}
          error={errors.find((e) => e.id === 'organisationName')?.message}
          onChange={(event) => onChange({ ...draft, organisationName: event.target.value })}
        />
        <Textarea
          id="address"
          label="Organisation address"
          value={draft.address ?? ''}
          error={errors.find((e) => e.id === 'address')?.message}
          onChange={(event) => onChange({ ...draft, address: event.target.value })}
        />
        <Input
          id="contactEmail"
          label="Contact email"
          type="email"
          hint="Contact data for this organisation. This is not a Cognito login and not GOV.UK One Login."
          value={draft.contactEmail ?? ''}
          error={errors.find((e) => e.id === 'contactEmail')?.message}
          onChange={(event) => onChange({ ...draft, contactEmail: event.target.value })}
        />
      </Fieldset>
      <Button type="submit">Register waste operator</Button>
    </form>
  )
}
