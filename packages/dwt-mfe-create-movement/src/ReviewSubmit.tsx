import { useState } from 'react'
import { Button, ErrorSummary, Input } from '@dwt/govuk'
import type { CreateMovementDraft } from './types'
import { assembleCreateMovementBody, validateReviewSlice } from './validate'

function newApiCode(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return '25b14080-5e77-4f91-9957-2482a0cb8775'
}

export function ReviewSubmit({
  value,
  onChange,
  onSubmit,
}: {
  value: CreateMovementDraft
  onChange: (draft: CreateMovementDraft) => void
  onSubmit: (body: Record<string, unknown>) => void
}) {
  const draft = {
    ...value,
    apiCode: value.apiCode || newApiCode(),
  }
  const [errors, setErrors] = useState<{ id: string; message: string }[]>([])

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const next = validateReviewSlice(draft)
        setErrors(next)
        if (next.length === 0) {
          onSubmit(assembleCreateMovementBody(draft))
        }
      }}
    >
      <ErrorSummary errors={errors} />
      <h2 className="govuk-heading-m">Check your answers</h2>
      <dl className="govuk-summary-list">
        <div className="govuk-summary-list__row">
          <dt className="govuk-summary-list__key">Producer</dt>
          <dd className="govuk-summary-list__value">{draft.producer?.organisationName || 'Not provided'}</dd>
        </div>
        <div className="govuk-summary-list__row">
          <dt className="govuk-summary-list__key">Carriers</dt>
          <dd className="govuk-summary-list__value">{draft.intendedCarriers?.length ?? 0}</dd>
        </div>
        <div className="govuk-summary-list__row">
          <dt className="govuk-summary-list__key">Waste items</dt>
          <dd className="govuk-summary-list__value">{draft.wasteItems?.length ?? 0}</dd>
        </div>
      </dl>
      <Input
        id="plannedCollectionTime"
        label="Planned collection date and time"
        type="datetime-local"
        hint="Stored as an ISO timestamp on POST /movements."
        value={toLocalInput(draft.plannedCollectionTime)}
        error={errors.find((e) => e.id === 'plannedCollectionTime')?.message}
        onChange={(event) =>
          onChange({ ...draft, plannedCollectionTime: fromLocalInput(event.target.value) })
        }
      />
      <Input
        id="apiCode"
        label="API code"
        hint="A UUID the software generates for this submission."
        value={draft.apiCode ?? ''}
        error={errors.find((e) => e.id === 'apiCode')?.message}
        onChange={(event) => onChange({ ...draft, apiCode: event.target.value })}
      />
      <Button type="submit">Submit movement</Button>
    </form>
  )
}

function toLocalInput(iso?: string): string {
  if (!iso) {
    return ''
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 16)
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(local: string): string {
  if (!local) {
    return ''
  }
  const date = new Date(local)
  return Number.isNaN(date.getTime()) ? local : date.toISOString()
}
