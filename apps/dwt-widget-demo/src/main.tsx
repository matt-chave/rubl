import { registerCreateMovementElements } from '@dwt/mfe-create-movement'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import 'govuk-frontend/dist/govuk/govuk-frontend.min.css'

registerCreateMovementElements()

function Demo() {
  const [log, setLog] = useState<string>('Events from the widgets appear here. This page is not the operator shell.')

  useEffect(() => {
    const onChange = (event: Event) => {
      setLog(`dwt-change: ${JSON.stringify((event as CustomEvent).detail)}`)
    }
    document.addEventListener('dwt-change', onChange)
    document.addEventListener('dwt-valid', onChange)
    return () => {
      document.removeEventListener('dwt-change', onChange)
      document.removeEventListener('dwt-valid', onChange)
    }
  }, [])

  return (
    <div className="govuk-width-container">
      <main className="govuk-main-wrapper" id="main-content">
        <h1 className="govuk-heading-l">Assemble two widgets in another app</h1>
        <p className="govuk-body">
          A third-party product can drop <code>dwt-producer</code> and <code>dwt-waste-items</code> into
          its own page. The host listens for <code>dwt-change</code> and <code>dwt-valid</code>, then
          submits with its own credentials. The widgets do not call Digital Waste Tracking. Those events
          are what a vendor would map onto their own API client; this demo only logs them.
        </p>
        <h2 className="govuk-heading-m">Producer widget</h2>
        <dwt-producer></dwt-producer>
        <h2 className="govuk-heading-m">Waste items widget</h2>
        <dwt-waste-items></dwt-waste-items>
        <h2 className="govuk-heading-m">Host event log</h2>
        <p className="govuk-body">{log}</p>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
)
