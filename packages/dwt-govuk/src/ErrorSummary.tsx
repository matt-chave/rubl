export function ErrorSummary({
  title = 'There is a problem',
  errors,
}: {
  title?: string
  errors: { id: string; message: string }[]
}) {
  if (errors.length === 0) {
    return null
  }
  return (
    <div className="govuk-error-summary" data-module="govuk-error-summary">
      <div role="alert">
        <h2 className="govuk-error-summary__title">{title}</h2>
        <div className="govuk-error-summary__body">
          <ul className="govuk-list govuk-error-summary__list">
            {errors.map((error) => (
              <li key={error.id}>
                <a href={`#${error.id}`}>{error.message}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
