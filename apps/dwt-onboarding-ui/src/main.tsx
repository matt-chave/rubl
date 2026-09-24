import { registerOperatorSignupElement } from '@dwt/mfe-operator-signup'
import { registerSoftwareProviderSignupElement } from '@dwt/mfe-software-provider-signup'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'govuk-frontend/dist/govuk/govuk-frontend.min.css'
import { App } from './App'

registerSoftwareProviderSignupElement()
registerOperatorSignupElement()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
