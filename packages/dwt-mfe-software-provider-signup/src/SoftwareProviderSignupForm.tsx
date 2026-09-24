import { useState } from 'react'
import { Button, ErrorSummary, Fieldset, Input } from '@dwt/govuk'
import { EMPTY_SOFTWARE_PROVIDER, type SoftwareProviderSignup } from './types'
import { assembleSoftwareProviderBody, validateSoftwareProviderSlice } from './validate'

export function SoftwareProviderSignupForm({
  value,
  onChange,
  onSubmit,
}: {
  value?: SoftwareProviderSignup
  onChange: (next: SoftwareProviderSignup) => void
  onSubmit?: (body: { productName: string; contactEmail: string }) => void
}) {
  const draft: SoftwareProviderSignup = { ...EMPTY_SOFTWARE_PROVIDER, ...value }
  const [errors, setErrors] = useState<{ id: string; message: string }[]>([])

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const next = validateSoftwareProviderSlice(draft)
        setErrors(next)
        if (next.length === 0) {
          onSubmit?.(assembleSoftwareProviderBody(draft))
        }
      }}
    >
      <ErrorSummary errors={errors} />
      <Fieldset legend="Software provider details">
        <Input
          id="productName"
          label="Product name"
          hint="The name of the software product that will call Digital Waste Tracking."
          value={draft.productName ?? ''}
          error={errors.find((e) => e.id === 'productName')?.message}
          onChange={(event) => onChange({ ...draft, productName: event.target.value })}
        />
        <Input
          id="contactEmail"
          label="Provider contact email"
          type="email"
          hint="Who we should contact about this registration. This is not a Cognito login."
          value={draft.contactEmail ?? ''}
          error={errors.find((e) => e.id === 'contactEmail')?.message}
          onChange={(event) => onChange({ ...draft, contactEmail: event.target.value })}
        />
      </Fieldset>
      <Button type="submit">Register software provider</Button>
    </form>
  )
}
