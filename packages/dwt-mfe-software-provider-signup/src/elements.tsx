import { createRoot, type Root } from 'react-dom/client'
import { SoftwareProviderSignupForm } from './SoftwareProviderSignupForm'
import type { SoftwareProviderSignup } from './types'

function emit(el: HTMLElement, name: string, detail: unknown): void {
  el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }))
}

export function registerSoftwareProviderSignupElement(): void {
  const tag = 'dwt-software-provider-signup'
  if (customElements.get(tag)) {
    return
  }
  class DwtSoftwareProviderSignup extends HTMLElement {
    #root?: Root
    #value: SoftwareProviderSignup = {}

    get value(): SoftwareProviderSignup {
      return this.#value
    }

    set value(next: SoftwareProviderSignup) {
      this.#value = next
      this.#paint()
    }

    connectedCallback(): void {
      this.#root = createRoot(this)
      this.#paint()
    }

    disconnectedCallback(): void {
      this.#root?.unmount()
      this.#root = undefined
    }

    #paint(): void {
      if (!this.#root) {
        return
      }
      this.#root.render(
        <SoftwareProviderSignupForm
          value={this.#value}
          onChange={(next) => {
            this.#value = next
            emit(this, 'dwt-change', next)
            this.#paint()
          }}
          onSubmit={(body) => emit(this, 'dwt-submit', body)}
        />,
      )
    }
  }
  customElements.define(tag, DwtSoftwareProviderSignup)
}

export const SOFTWARE_PROVIDER_SIGNUP_TAG = 'dwt-software-provider-signup' as const
