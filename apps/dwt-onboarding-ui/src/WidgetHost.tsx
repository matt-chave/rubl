import { useEffect, useRef } from 'react'

export function WidgetHost({
  tag,
  value,
  onChange,
  onSubmit,
}: {
  tag: 'dwt-software-provider-signup' | 'dwt-operator-signup'
  value: unknown
  onChange?: (detail: unknown) => void
  onSubmit?: (detail: unknown) => void
}) {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = ref.current as (HTMLElement & { value: unknown }) | null
    if (!el) {
      return
    }
    el.value = value
    const change = (event: Event) => onChange?.((event as CustomEvent).detail)
    const submit = (event: Event) => onSubmit?.((event as CustomEvent).detail)
    el.addEventListener('dwt-change', change)
    el.addEventListener('dwt-submit', submit)
    return () => {
      el.removeEventListener('dwt-change', change)
      el.removeEventListener('dwt-submit', submit)
    }
  }, [value, onChange, onSubmit])

  return (
    <div
      ref={(node) => {
        if (node && !ref.current) {
          const el = document.createElement(tag)
          node.replaceChildren(el)
          ref.current = el
          ;(el as HTMLElement & { value: unknown }).value = value
        }
      }}
    />
  )
}
