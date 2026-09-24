import { createRoot, type Root } from 'react-dom/client'
import { OperatorSignupForm } from './OperatorSignupForm'
import type { OperatorSignup } from './types'

function emit(el: HTMLElement, name: string, detail: unknown): void {
  el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }))
}

export function registerOperatorSignupElement(): void {
  const tag = 'dwt-operator-signup'
  if (customElements.get(tag)) {
    return
  }
  class DwtOperatorSignup extends HTMLElement {
    #root?: Root
    #value: OperatorSignup = {}

    get value(): OperatorSignup {
      return this.#value
    }

    set value(next: OperatorSignup) {
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
        <OperatorSignupForm
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
  customElements.define(tag, DwtOperatorSignup)
}

export const OPERATOR_SIGNUP_TAG = 'dwt-operator-signup' as const
