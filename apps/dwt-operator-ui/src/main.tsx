import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { registerCreateMovementElements } from '@dwt/mfe-create-movement'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'govuk-frontend/dist/govuk/govuk-frontend.min.css'
import { App } from './App'

registerCreateMovementElements()

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
