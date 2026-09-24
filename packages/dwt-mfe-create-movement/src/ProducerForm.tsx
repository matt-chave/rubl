import { useState } from 'react'
import { Button, ErrorSummary, Fieldset, Input, Radios } from '@dwt/govuk'
import { EMPTY_PRODUCER, type Producer } from './types'
import { validateProducerSlice } from './validate'

export function ProducerForm({
  value,
  onChange,
  onSave,
}: {
  value?: Producer
  onChange: (producer: Producer) => void
  onSave?: (producer: Producer) => void
}) {
  const producer: Producer = {
    ...EMPTY_PRODUCER,
    ...value,
    address: {
      fullAddress: value?.address?.fullAddress ?? EMPTY_PRODUCER.address!.fullAddress,
      postcode: value?.address?.postcode ?? EMPTY_PRODUCER.address!.postcode,
    },
  }
  const [errors, setErrors] = useState<{ id: string; message: string }[]>([])

  const set = (patch: Partial<Producer>) => {
    onChange({ ...producer, ...patch })
  }

  const setAddress = (patch: Partial<NonNullable<Producer['address']>>) => {
    set({
      address: {
        fullAddress: patch.fullAddress ?? producer.address!.fullAddress,
        postcode: patch.postcode ?? producer.address!.postcode,
      },
    })
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const next = validateProducerSlice(producer)
        setErrors(next)
        if (next.length === 0) {
          onSave?.(producer)
        }
      }}
    >
      <ErrorSummary errors={errors} />
      <Fieldset legend="Producer">
        <Radios
          name="wasteSource"
          legend="Waste source"
          value={producer.wasteSource}
          onChange={(wasteSource) => set({ wasteSource: wasteSource as Producer['wasteSource'] })}
          options={[
            { value: 'Household', label: 'Household' },
            { value: 'Commercial', label: 'Commercial' },
            { value: 'Municipal', label: 'Municipal' },
          ]}
        />
        <Input
          id="organisationName"
          label="Organisation name"
          value={producer.organisationName ?? ''}
          error={errors.find((e) => e.id === 'organisationName')?.message}
          onChange={(event) => set({ organisationName: event.target.value })}
        />
        <Input
          id="sicCode"
          label="SIC code"
          width="10"
          value={producer.sicCode ?? ''}
          error={errors.find((e) => e.id === 'sicCode')?.message}
          onChange={(event) => set({ sicCode: event.target.value })}
        />
        <Input
          id="authorisationNumber"
          label="Authorisation number"
          value={producer.authorisationNumber ?? ''}
          error={errors.find((e) => e.id === 'authorisationNumber')?.message}
          onChange={(event) => set({ authorisationNumber: event.target.value })}
        />
        <Input
          id="emailAddress"
          label="Email address"
          type="email"
          value={producer.emailAddress ?? ''}
          error={errors.find((e) => e.id === 'emailAddress')?.message}
          onChange={(event) => set({ emailAddress: event.target.value })}
        />
        <Input
          id="fullAddress"
          label="Address"
          value={producer.address?.fullAddress ?? ''}
          error={errors.find((e) => e.id === 'fullAddress')?.message}
          onChange={(event) => setAddress({ fullAddress: event.target.value })}
        />
        <Input
          id="postcode"
          label="Postcode"
          width="10"
          value={producer.address?.postcode ?? ''}
          error={errors.find((e) => e.id === 'postcode')?.message}
          onChange={(event) => setAddress({ postcode: event.target.value })}
        />
      </Fieldset>
      <Button type="submit">Save and continue</Button>
    </form>
  )
}
