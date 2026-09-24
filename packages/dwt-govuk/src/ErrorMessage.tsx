export function ErrorMessage({ id, children }: { id?: string; children: string }) {
  return (
    <p id={id} className="govuk-error-message">
      <span className="govuk-visually-hidden">Error:</span> {children}
    </p>
  )
}
