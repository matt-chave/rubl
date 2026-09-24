import { createRoot, type Root } from 'react-dom/client'
import { CarriersForm } from './CarriersForm'
import { ProducerForm } from './ProducerForm'
import { ReviewSubmit } from './ReviewSubmit'
import { WasteItemsForm } from './WasteItemsForm'
import type { CreateMovementDraft, IntendedCarrier, Producer, WasteItem } from './types'

function emit(el: HTMLElement, name: string, detail: unknown): void {
  el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }))
}

function defineReactElement(
  tag: string,
  render: (host: HTMLElement, value: unknown, root: Root) => void,
): void {
  if (customElements.get(tag)) {
    return
  }
  class DwtWidget extends HTMLElement {
    #root?: Root
    #value: unknown

    get value(): unknown {
      return this.#value
    }

    set value(next: unknown) {
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
      render(this, this.#value, this.#root)
    }
  }
  customElements.define(tag, DwtWidget)
}

export function registerCreateMovementElements(): void {
  defineReactElement('dwt-producer', (host, value, root) => {
    root.render(
      <ProducerForm
        value={value as Producer | undefined}
        onChange={(producer) => {
          ;(host as HTMLElement & { value: unknown }).value = producer
          emit(host, 'dwt-change', { producer })
        }}
        onSave={(producer) => emit(host, 'dwt-valid', { producer })}
      />,
    )
  })

  defineReactElement('dwt-carriers', (host, value, root) => {
    root.render(
      <CarriersForm
        value={value as IntendedCarrier[] | undefined}
        onChange={(intendedCarriers) => {
          ;(host as HTMLElement & { value: unknown }).value = intendedCarriers
          emit(host, 'dwt-change', { intendedCarriers })
        }}
        onSave={(intendedCarriers) => emit(host, 'dwt-valid', { intendedCarriers })}
      />,
    )
  })

  defineReactElement('dwt-waste-items', (host, value, root) => {
    root.render(
      <WasteItemsForm
        value={value as WasteItem[] | undefined}
        onChange={(wasteItems) => {
          ;(host as HTMLElement & { value: unknown }).value = wasteItems
          emit(host, 'dwt-change', { wasteItems })
        }}
        onSave={(wasteItems) => emit(host, 'dwt-valid', { wasteItems })}
      />,
    )
  })

  defineReactElement('dwt-review-submit', (host, value, root) => {
    const draft = (value as CreateMovementDraft) ?? {}
    root.render(
      <ReviewSubmit
        value={draft}
        onChange={(next) => {
          ;(host as HTMLElement & { value: unknown }).value = next
          emit(host, 'dwt-change', next)
        }}
        onSubmit={(body) => emit(host, 'dwt-submit', body)}
      />,
    )
  })
}

export const CREATE_MOVEMENT_TAGS = ['dwt-producer', 'dwt-carriers', 'dwt-waste-items', 'dwt-review-submit'] as const
