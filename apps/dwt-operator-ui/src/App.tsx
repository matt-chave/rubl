import { useEnsureReservedIds, useFlushQueue, useOfflineQueue, useReservedIds, useSubmitMovement } from '@dwt/operator-client'
import type { CreateMovementDraft } from '@dwt/mfe-create-movement'
import { useEffect, useState } from 'react'
import { Layout } from './Layout'
import { WidgetHost } from './WidgetHost'

type Page = 'start' | 'tasks' | 'producer' | 'carriers' | 'waste' | 'review' | 'done'

type SubmitOutcome = {
  queued: boolean
  movementId?: string
  message: string
}

export function App() {
  const [page, setPage] = useState<Page>('start')
  const [draft, setDraft] = useState<CreateMovementDraft>({})
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null)
  const [submitError, setSubmitError] = useState<string>('')
  const reserve = useEnsureReservedIds()
  const reserved = useReservedIds()
  const queue = useOfflineQueue()
  const flush = useFlushQueue()
  const submit = useSubmitMovement()

  useEffect(() => {
    if (page === 'tasks' || page === 'review') {
      reserve.mutate()
    }
  }, [page])

  useEffect(() => {
    const online = () => flush.mutate()
    window.addEventListener('online', online)
    return () => window.removeEventListener('online', online)
  }, [flush])

  const reservedCount = reserved.data?.length ?? 0
  const queuedCount = queue.data?.length ?? 0

  return (
    <Layout>
      {page === 'start' ? (
        <>
          <h1 className="govuk-heading-xl">Report a waste movement</h1>
          <p className="govuk-body">
            Use this service if you are a waste operator reporting a planned movement. This first-party
            app is approved software. Your operator API key stays on the local BFF, not in the browser
            and not inside the widgets.
          </p>
          <p className="govuk-body">
            While you are online we reserve a small pool of movement IDs for later, but an ordinary
            submit does not use them — the API mints a new id. If you go offline after that pool is
            ready, you can still complete the form; we attach one reserved id and send the queued
            movement when the connection returns.
          </p>
          <button type="button" className="govuk-button govuk-button--start" onClick={() => setPage('tasks')}>
            Start now
          </button>
        </>
      ) : null}

      {page === 'tasks' ? (
        <>
          <h1 className="govuk-heading-l">Create a movement</h1>
          <p className="govuk-body">
            Reserved movement IDs ready: <strong>{reservedCount}</strong>. Offline queue:{' '}
            <strong>{queuedCount}</strong>.
          </p>
          {reserve.isError ? (
            <p className="govuk-body">
              We could not reserve IDs. Check the BFF is running with <code className="govuk-!-font-size-16">npm run bff</code> and
              that <code className="govuk-!-font-size-16">.env.local</code> is filled.
            </p>
          ) : null}
          <ol className="govuk-list">
            <li>
              <a className="govuk-link" href="#producer" onClick={(e) => { e.preventDefault(); setPage('producer') }}>
                Producer details
              </a>
              {draft.producer?.organisationName ? ' — Completed' : ' — Not started'}
            </li>
            <li>
              <a className="govuk-link" href="#carriers" onClick={(e) => { e.preventDefault(); setPage('carriers') }}>
                Intended carriers
              </a>
              {draft.intendedCarriers?.length ? ' — Completed' : ' — Not started'}
            </li>
            <li>
              <a className="govuk-link" href="#waste" onClick={(e) => { e.preventDefault(); setPage('waste') }}>
                Waste items
              </a>
              {draft.wasteItems?.length ? ' — Completed' : ' — Not started'}
            </li>
            <li>
              <a className="govuk-link" href="#review" onClick={(e) => { e.preventDefault(); setPage('review') }}>
                Review and submit
              </a>
            </li>
          </ol>
          {queuedCount > 0 ? (
            <button type="button" className="govuk-button govuk-button--secondary" onClick={() => flush.mutate()}>
              Send queued movements
            </button>
          ) : null}
        </>
      ) : null}

      {page === 'producer' ? (
        <>
          <p className="govuk-body">
            <a className="govuk-back-link" href="#tasks" onClick={(e) => { e.preventDefault(); setPage('tasks') }}>
              Back
            </a>
          </p>
          <h1 className="govuk-heading-l">Producer</h1>
          <WidgetHost
            tag="dwt-producer"
            value={draft.producer}
            onChange={(detail) => setDraft((current) => ({ ...current, ...(detail as object) }))}
            onValid={(detail) => {
              setDraft((current) => ({ ...current, ...(detail as object) }))
              setPage('tasks')
            }}
          />
        </>
      ) : null}

      {page === 'carriers' ? (
        <>
          <p className="govuk-body">
            <a className="govuk-back-link" href="#tasks" onClick={(e) => { e.preventDefault(); setPage('tasks') }}>
              Back
            </a>
          </p>
          <h1 className="govuk-heading-l">Intended carriers</h1>
          <WidgetHost
            tag="dwt-carriers"
            value={draft.intendedCarriers}
            onChange={(detail) => setDraft((current) => ({ ...current, ...(detail as object) }))}
            onValid={(detail) => {
              setDraft((current) => ({ ...current, ...(detail as object) }))
              setPage('tasks')
            }}
          />
        </>
      ) : null}

      {page === 'waste' ? (
        <>
          <p className="govuk-body">
            <a className="govuk-back-link" href="#tasks" onClick={(e) => { e.preventDefault(); setPage('tasks') }}>
              Back
            </a>
          </p>
          <h1 className="govuk-heading-l">Waste items</h1>
          <WidgetHost
            tag="dwt-waste-items"
            value={draft.wasteItems}
            onChange={(detail) => setDraft((current) => ({ ...current, ...(detail as object) }))}
            onValid={(detail) => {
              setDraft((current) => ({ ...current, ...(detail as object) }))
              setPage('tasks')
            }}
          />
        </>
      ) : null}

      {page === 'review' ? (
        <>
          <p className="govuk-body">
            <a className="govuk-back-link" href="#tasks" onClick={(e) => { e.preventDefault(); setPage('tasks') }}>
              Back
            </a>
          </p>
          <h1 className="govuk-heading-l">Review and submit</h1>
          <div className="govuk-inset-text">
            <h2 className="govuk-heading-s">What happens when you submit</h2>
            <p className="govuk-body">
              The review widget only fires a <code className="govuk-!-font-size-16">dwt-submit</code> event.
              This shell listens in <code className="govuk-!-font-size-16">WidgetHost</code>, then
              <code className="govuk-!-font-size-16"> useSubmitMovement</code> posts to
              <code className="govuk-!-font-size-16"> /bff/movements</code>. Online, the body omits
              <code className="govuk-!-font-size-16"> movementId</code> and the API returns a new one.
              Offline, we take one reserved id from the local pool and queue the body until you are
              back online. The local BFF attaches the software JWT and your operator API key;
              secrets never leave the BFF. Reserved IDs ready for offline use:{' '}
              <strong>{reservedCount}</strong>.
            </p>
          </div>
          {reservedCount === 0 && typeof navigator !== 'undefined' && !navigator.onLine ? (
            <div className="govuk-warning-text">
              <span className="govuk-warning-text__icon" aria-hidden="true">!</span>
              <strong className="govuk-warning-text__text">
                You have no reserved movement IDs and you are offline. Connect and open this page so we
                can reserve IDs first.
              </strong>
            </div>
          ) : null}
          <WidgetHost
            tag="dwt-review-submit"
            value={draft}
            onChange={(detail) => setDraft(detail as CreateMovementDraft)}
            onSubmit={(detail) => {
              setSubmitError('')
              submit.mutate(detail as Parameters<typeof submit.mutate>[0], {
                onSuccess: (result) => {
                  setOutcome({
                    queued: result.queued,
                    movementId: result.movementId,
                    message: result.queued
                      ? `Saved offline as ${result.movementId}. We will send it through the BFF when you are back online.`
                      : `Sent through the local BFF to Digital Waste Tracking${result.movementId ? ` as ${result.movementId}` : ''}.`,
                  })
                  setPage('done')
                },
                onError: (error) =>
                  setSubmitError(error instanceof Error ? error.message : 'Submit failed'),
              })
            }}
          />
          {submitError || submit.isError ? (
            <p className="govuk-error-message">
              {submitError || (submit.error instanceof Error ? submit.error.message : 'Submit failed')}
            </p>
          ) : null}
        </>
      ) : null}

      {page === 'done' ? (
        <>
          <div className="govuk-panel govuk-panel--confirmation">
            <h1 className="govuk-panel__title">
              {outcome?.queued ? 'Movement saved offline' : 'Movement recorded'}
            </h1>
            <div className="govuk-panel__body">{outcome?.message}</div>
          </div>
          <h2 className="govuk-heading-m">How this reached Digital Waste Tracking</h2>
          <dl className="govuk-summary-list">
            <div className="govuk-summary-list__row">
              <dt className="govuk-summary-list__key">Widget event</dt>
              <dd className="govuk-summary-list__value">
                <code className="govuk-!-font-size-16">dwt-submit</code> from{' '}
                <code className="govuk-!-font-size-16">dwt-review-submit</code>
              </dd>
            </div>
            <div className="govuk-summary-list__row">
              <dt className="govuk-summary-list__key">Shell</dt>
              <dd className="govuk-summary-list__value">
                <code className="govuk-!-font-size-16">WidgetHost</code> →{' '}
                <code className="govuk-!-font-size-16">useSubmitMovement</code>
              </dd>
            </div>
            <div className="govuk-summary-list__row">
              <dt className="govuk-summary-list__key">Transport</dt>
              <dd className="govuk-summary-list__value">
                {outcome?.queued
                  ? 'Queued in IndexedDB (no BFF call while offline)'
                  : 'POST /bff/movements → BFF → POST /movements on DwtApi'}
              </dd>
            </div>
            <div className="govuk-summary-list__row">
              <dt className="govuk-summary-list__key">Status</dt>
              <dd className="govuk-summary-list__value">
                {outcome?.queued ? 'Queued' : 'Submitted'}
                {outcome?.movementId ? ` · ${outcome.movementId}` : ''}
              </dd>
            </div>
          </dl>
          <p className="govuk-body">
            <a
              className="govuk-link"
              href="#tasks"
              onClick={(e) => {
                e.preventDefault()
                setDraft({})
                setOutcome(null)
                setSubmitError('')
                setPage('tasks')
              }}
            >
              Create another movement
            </a>
          </p>
        </>
      ) : null}
    </Layout>
  )
}
