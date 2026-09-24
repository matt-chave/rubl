import type { ReactNode } from 'react'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#main-content" className="govuk-skip-link" data-module="govuk-skip-link">
        Skip to main content
      </a>
      <header className="govuk-header" data-module="govuk-header">
        <div className="govuk-header__container govuk-width-container">
          <div className="govuk-header__logo">
            <a href="#home" className="govuk-header__link govuk-header__link--homepage">
              <span className="govuk-header__logotype">
                <span className="govuk-header__logotype-text">GOV.UK</span>
              </span>
            </a>
          </div>
          <div className="govuk-header__content">
            <a href="#home" className="govuk-header__link govuk-header__service-name">
              Digital Waste Tracking onboarding
            </a>
          </div>
        </div>
      </header>
      <div className="govuk-width-container">
        <div className="govuk-phase-banner">
          <p className="govuk-phase-banner__content">
            <strong className="govuk-tag govuk-phase-banner__content__tag">Prototype</strong>
            <span className="govuk-phase-banner__text">
              Workshop registration front door. Secrets are shown once on this host page, never inside
              the widgets.
            </span>
          </p>
        </div>
        <main className="govuk-main-wrapper" id="main-content">
          <div className="govuk-grid-row">
            <div className="govuk-grid-column-two-thirds">{children}</div>
          </div>
        </main>
      </div>
    </>
  )
}
