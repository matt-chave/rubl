import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Button({
  children,
  secondary,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; secondary?: boolean }) {
  const extra = secondary ? ' govuk-button--secondary' : ''
  return (
    <button type="button" className={`govuk-button${extra}${className ? ` ${className}` : ''}`} data-module="govuk-button" {...props}>
      {children}
    </button>
  )
}
