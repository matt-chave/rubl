import { useState } from 'react'
import { Button, ErrorSummary, Fieldset, Input, Select, Textarea } from '@dwt/govuk'
import { EMPTY_WASTE_ITEM, type WasteItem } from './types'
import { validateWasteItemsSlice } from './validate'

export function WasteItemsForm({
  value,
  onChange,
  onSave,
}: {
  value?: WasteItem[]
  onChange: (items: WasteItem[]) => void
  onSave?: (items: WasteItem[]) => void
}) {
  const items = value && value.length > 0 ? value : [{ ...EMPTY_WASTE_ITEM, classification: { ...EMPTY_WASTE_ITEM.classification, ewcCodes: [''] }, intendedTreatments: [...EMPTY_WASTE_ITEM.intendedTreatments] }]
  const [errors, setErrors] = useState<{ id: string; message: string }[]>([])

  const update = (index: number, patch: WasteItem) => {
    onChange(items.map((item, i) => (i === index ? patch : item)))
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const next = validateWasteItemsSlice(items)
        setErrors(next)
        if (next.length === 0) {
          onSave?.(items)
        }
      }}
    >
      <ErrorSummary errors={errors} />
      {items.map((item, index) => {
        const prefix = `waste-${index}`
        return (
          <Fieldset key={index} legend={`Waste item ${index + 1}`}>
            <Input
              id={`${prefix}-weight`}
              label="Weight (tonnes)"
              type="number"
              width="5"
              value={String(item.weight.amount || '')}
              error={errors.find((e) => e.id === `${prefix}-weight`)?.message}
              onChange={(event) => {
                const amount = Number(event.target.value)
                const weight = { ...item.weight, amount }
                update(index, {
                  ...item,
                  weight,
                  intendedTreatments: item.intendedTreatments.map((treatment, i) =>
                    i === 0 ? { ...treatment, weight } : treatment,
                  ),
                })
              }}
            />
            <Input
              id={`${prefix}-containers`}
              label="Number of containers"
              type="number"
              width="4"
              value={String(item.numberOfContainers || '')}
              error={errors.find((e) => e.id === `${prefix}-containers`)?.message}
              onChange={(event) => update(index, { ...item, numberOfContainers: Number(event.target.value) })}
            />
            <Select
              id={`${prefix}-typeOfContainers`}
              label="Type of containers"
              value={item.typeOfContainers}
              error={errors.find((e) => e.id === `${prefix}-typeOfContainers`)?.message}
              onChange={(event) => update(index, { ...item, typeOfContainers: event.target.value })}
              options={[
                { value: 'SKI', label: 'Skip' },
                { value: 'BAG', label: 'Bag' },
                { value: 'DRUM', label: 'Drum' },
                { value: 'OTHER', label: 'Other' },
              ]}
            />
            <Select
              id={`${prefix}-physicalForm`}
              label="Physical form"
              value={item.physicalForm}
              error={errors.find((e) => e.id === `${prefix}-physicalForm`)?.message}
              onChange={(event) => update(index, { ...item, physicalForm: event.target.value })}
              options={[
                { value: 'Solid', label: 'Solid' },
                { value: 'Liquid', label: 'Liquid' },
                { value: 'Gas', label: 'Gas' },
                { value: 'Powder', label: 'Powder' },
                { value: 'Sludge', label: 'Sludge' },
              ]}
            />
            <Input
              id={`${prefix}-ewc`}
              label="EWC code"
              width="10"
              value={item.classification.ewcCodes[0] ?? ''}
              error={errors.find((e) => e.id === `${prefix}-ewc`)?.message}
              onChange={(event) =>
                update(index, {
                  ...item,
                  classification: { ...item.classification, ewcCodes: [event.target.value] },
                })
              }
            />
            <Textarea
              id={`${prefix}-description`}
              label="Waste description"
              value={item.classification.wasteDescription}
              error={errors.find((e) => e.id === `${prefix}-description`)?.message}
              onChange={(event) =>
                update(index, {
                  ...item,
                  classification: { ...item.classification, wasteDescription: event.target.value },
                })
              }
            />
            <Input
              id={`${prefix}-treatment`}
              label="Disposal or recovery code"
              width="4"
              value={item.intendedTreatments[0]?.disposalOrRecoveryCode ?? ''}
              error={errors.find((e) => e.id === `${prefix}-treatment`)?.message}
              onChange={(event) =>
                update(index, {
                  ...item,
                  intendedTreatments: [
                    {
                      ...item.intendedTreatments[0],
                      disposalOrRecoveryCode: event.target.value,
                      weight: item.weight,
                    },
                  ],
                })
              }
            />
          </Fieldset>
        )
      })}
      <p>
        <Button
          secondary
          type="button"
          onClick={() =>
            onChange([
              ...items,
              {
                ...EMPTY_WASTE_ITEM,
                classification: { ...EMPTY_WASTE_ITEM.classification, ewcCodes: [''] },
                intendedTreatments: [{ ...EMPTY_WASTE_ITEM.intendedTreatments[0] }],
              },
            ])
          }
        >
          Add another waste item
        </Button>
      </p>
      <Button type="submit">Save and continue</Button>
    </form>
  )
}
