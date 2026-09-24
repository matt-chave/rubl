import { useState } from 'react'
import { Button, ErrorSummary, Fieldset, Input, Select } from '@dwt/govuk'
import { EMPTY_CARRIER, type IntendedCarrier } from './types'
import { validateCarriersSlice } from './validate'

export function CarriersForm({
  value,
  onChange,
  onSave,
}: {
  value?: IntendedCarrier[]
  onChange: (carriers: IntendedCarrier[]) => void
  onSave?: (carriers: IntendedCarrier[]) => void
}) {
  const carriers = value && value.length > 0 ? value : [{ ...EMPTY_CARRIER }]
  const [errors, setErrors] = useState<{ id: string; message: string }[]>([])

  const update = (index: number, patch: Partial<IntendedCarrier>) => {
    const next = carriers.map((carrier, i) => (i === index ? { ...carrier, ...patch } : carrier))
    onChange(next)
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const next = validateCarriersSlice(carriers)
        setErrors(next)
        if (next.length === 0) {
          onSave?.(carriers)
        }
      }}
    >
      <ErrorSummary errors={errors} />
      {carriers.map((carrier, index) => (
        <Fieldset key={index} legend={`Intended carrier ${index + 1}`}>
          <Select
            id={`carrier-${index}-meansOfTransport`}
            label="Means of transport"
            value={carrier.meansOfTransport}
            error={errors.find((e) => e.id === `carrier-${index}-meansOfTransport`)?.message}
            onChange={(event) => update(index, { meansOfTransport: event.target.value })}
            options={[
              { value: 'Road', label: 'Road' },
              { value: 'Rail', label: 'Rail' },
              { value: 'Sea', label: 'Sea' },
              { value: 'Air', label: 'Air' },
              { value: 'InlandWaterway', label: 'Inland waterway' },
            ]}
          />
          <Input
            id={`carrier-${index}-organisationName`}
            label="Organisation name"
            value={carrier.organisationName}
            error={errors.find((e) => e.id === `carrier-${index}-organisationName`)?.message}
            onChange={(event) => update(index, { organisationName: event.target.value })}
          />
          <Input
            id={`carrier-${index}-emailAddress`}
            label="Email address (optional)"
            type="email"
            value={carrier.emailAddress ?? ''}
            onChange={(event) => update(index, { emailAddress: event.target.value })}
          />
        </Fieldset>
      ))}
      <p>
        <Button
          secondary
          type="button"
          onClick={() => onChange([...carriers, { ...EMPTY_CARRIER }])}
        >
          Add another carrier
        </Button>
      </p>
      <Button type="submit">Save and continue</Button>
    </form>
  )
}
