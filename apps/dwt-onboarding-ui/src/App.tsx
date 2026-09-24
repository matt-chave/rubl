import { useState } from 'react'
import { Layout } from './Layout'
import { WidgetHost } from './WidgetHost'

type Page = 'home' | 'software' | 'operator'

type SoftwareCredentials = {
  softwareProviderId: string
  clientId: string
  clientSecret: string
  tokenUrl: string
  scope?: string
}

type OperatorCredentials = {
  operatorId: string
  apiKey: string
  organisationName: string
}

export function App() {
  const [page, setPage] = useState<Page>('home')
  const [softwareDraft, setSoftwareDraft] = useState<Record<string, unknown>>({})
  const [operatorDraft, setOperatorDraft] = useState<Record<string, unknown>>({})
  const [softwareResult, setSoftwareResult] = useState<SoftwareCredentials | null>(null)
  const [operatorResult, setOperatorResult] = useState<OperatorCredentials | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function postJson(path: string, body: unknown): Promise<Record<string, unknown>> {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const parsed = (await response.json()) as Record<string, unknown>
    if (!response.ok) {
      const message =
        typeof parsed.message === 'string'
          ? parsed.message
          : `Request failed (${response.status})`
      throw new Error(message)
    }
    return parsed
  }

  return (
    <Layout>
      {page === 'home' ? (
        <>
          <h1 className="govuk-heading-xl">Register with Digital Waste Tracking</h1>
          <p className="govuk-body">
            The onboarding team issues software credentials and waste-operator API keys. These forms
            are Web Components. They emit <code className="govuk-!-font-size-16">dwt-submit</code>;
            this host calls the local BFF, which talks to the onboarding API. The widgets never call
            AWS and never hold secrets.
          </p>
          <ul className="govuk-list govuk-list--bullet">
            <li>
              <a
                className="govuk-link"
                href="#software"
                onClick={(e) => {
                  e.preventDefault()
                  setError('')
                  setPage('software')
                }}
              >
                Register as a software provider
              </a>
            </li>
            <li>
              <a
                className="govuk-link"
                href="#operator"
                onClick={(e) => {
                  e.preventDefault()
                  setError('')
                  setPage('operator')
                }}
              >
                Register as a waste operator
              </a>
            </li>
          </ul>
        </>
      ) : null}

      {page === 'software' ? (
        <>
          <p className="govuk-body">
            <a
              className="govuk-back-link"
              href="#home"
              onClick={(e) => {
                e.preventDefault()
                setPage('home')
              }}
            >
              Back
            </a>
          </p>
          <h1 className="govuk-heading-l">Software provider registration</h1>
          <p className="govuk-body">
            Successful signup returns a Cognito <code className="govuk-!-font-size-16">clientId</code>,{' '}
            <code className="govuk-!-font-size-16">clientSecret</code>, and{' '}
            <code className="govuk-!-font-size-16">tokenUrl</code> once. Copy them into Bruno, then use
            Get token as in lesson 5. The sandbox client <code className="govuk-!-font-size-16">dwt-vendor-software</code>{' '}
            remains as a fallback.
          </p>
          {!softwareResult ? (
            <WidgetHost
              tag="dwt-software-provider-signup"
              value={softwareDraft}
              onChange={(detail) => setSoftwareDraft(detail as Record<string, unknown>)}
              onSubmit={(detail) => {
                setBusy(true)
                setError('')
                postJson('/bff/software-providers', detail)
                  .then((body) => {
                    setSoftwareResult({
                      softwareProviderId: String(body.softwareProviderId ?? ''),
                      clientId: String(body.clientId ?? ''),
                      clientSecret: String(body.clientSecret ?? ''),
                      tokenUrl: String(body.tokenUrl ?? ''),
                      scope: body.scope ? String(body.scope) : undefined,
                    })
                  })
                  .catch((err) => setError(err instanceof Error ? err.message : 'Signup failed'))
                  .finally(() => setBusy(false))
              }}
            />
          ) : (
            <div className="govuk-panel govuk-panel--confirmation">
              <h2 className="govuk-panel__title">Software provider registered</h2>
              <div className="govuk-panel__body">
                Copy these values now. The client secret is not stored by Digital Waste Tracking.
              </div>
            </div>
          )}
          {softwareResult ? (
            <dl className="govuk-summary-list">
              <div className="govuk-summary-list__row">
                <dt className="govuk-summary-list__key">Software provider id</dt>
                <dd className="govuk-summary-list__value">{softwareResult.softwareProviderId}</dd>
              </div>
              <div className="govuk-summary-list__row">
                <dt className="govuk-summary-list__key">Client id</dt>
                <dd className="govuk-summary-list__value">
                  <code className="govuk-!-font-size-16">{softwareResult.clientId}</code>
                </dd>
              </div>
              <div className="govuk-summary-list__row">
                <dt className="govuk-summary-list__key">Client secret</dt>
                <dd className="govuk-summary-list__value">
                  <code className="govuk-!-font-size-16">{softwareResult.clientSecret}</code>
                </dd>
              </div>
              <div className="govuk-summary-list__row">
                <dt className="govuk-summary-list__key">Token URL</dt>
                <dd className="govuk-summary-list__value">
                  <code className="govuk-!-font-size-16">{softwareResult.tokenUrl}</code>
                </dd>
              </div>
            </dl>
          ) : null}
          {busy ? <p className="govuk-body">Registering…</p> : null}
          {error ? <p className="govuk-error-message">{error}</p> : null}
        </>
      ) : null}

      {page === 'operator' ? (
        <>
          <p className="govuk-body">
            <a
              className="govuk-back-link"
              href="#home"
              onClick={(e) => {
                e.preventDefault()
                setPage('home')
              }}
            >
              Back
            </a>
          </p>
          <h1 className="govuk-heading-l">Waste operator registration</h1>
          <p className="govuk-body">
            Successful signup returns an API Gateway key once. Store it in Bruno as{' '}
            <code className="govuk-!-font-size-16">apiKey</code>. The key cannot call{' '}
            <code className="govuk-!-font-size-16">POST /movements</code> until{' '}
            <code className="govuk-!-font-size-16">DwtApi</code> is deployed in lesson 7 and attaches
            the onboarding usage plan to the movements stage.
          </p>
          {!operatorResult ? (
            <WidgetHost
              tag="dwt-operator-signup"
              value={operatorDraft}
              onChange={(detail) => setOperatorDraft(detail as Record<string, unknown>)}
              onSubmit={(detail) => {
                setBusy(true)
                setError('')
                postJson('/bff/operators', detail)
                  .then((body) => {
                    setOperatorResult({
                      operatorId: String(body.operatorId ?? ''),
                      apiKey: String(body.apiKey ?? ''),
                      organisationName: String(body.organisationName ?? ''),
                    })
                  })
                  .catch((err) => setError(err instanceof Error ? err.message : 'Signup failed'))
                  .finally(() => setBusy(false))
              }}
            />
          ) : (
            <div className="govuk-panel govuk-panel--confirmation">
              <h2 className="govuk-panel__title">Waste operator registered</h2>
              <div className="govuk-panel__body">
                Copy the API key now. Digital Waste Tracking does not store the key value.
              </div>
            </div>
          )}
          {operatorResult ? (
            <dl className="govuk-summary-list">
              <div className="govuk-summary-list__row">
                <dt className="govuk-summary-list__key">Operator id</dt>
                <dd className="govuk-summary-list__value">{operatorResult.operatorId}</dd>
              </div>
              <div className="govuk-summary-list__row">
                <dt className="govuk-summary-list__key">Organisation</dt>
                <dd className="govuk-summary-list__value">{operatorResult.organisationName}</dd>
              </div>
              <div className="govuk-summary-list__row">
                <dt className="govuk-summary-list__key">API key</dt>
                <dd className="govuk-summary-list__value">
                  <code className="govuk-!-font-size-16">{operatorResult.apiKey}</code>
                </dd>
              </div>
            </dl>
          ) : null}
          {busy ? <p className="govuk-body">Registering…</p> : null}
          {error ? <p className="govuk-error-message">{error}</p> : null}
        </>
      ) : null}
    </Layout>
  )
}
