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
            <a href="#start" className="govuk-header__link govuk-header__link--homepage">
              <span className="govuk-header__logotype">
                <span className="govuk-header__logotype-text">GOV.UK</span>
              </span>
            </a>
          </div>
          <div className="govuk-header__content">
            <a href="#start" className="govuk-header__link govuk-header__service-name">
              Digital Waste Tracking
            </a>
          </div>
        </div>
      </header>
      <div className="govuk-width-container">
        <div className="govuk-phase-banner">
          <p className="govuk-phase-banner__content">
            <strong className="govuk-tag govuk-phase-banner__content__tag">Prototype</strong>
            <span className="govuk-phase-banner__text">
              This is a workshop service for operators. It is not the live GOV.UK service.
            </span>
          </p>
        </div>
        <main className="govuk-main-wrapper" id="main-content">
          <div className="govuk-grid-row">
            <div className="govuk-grid-column-two-thirds">{children}</div>
          </div>
        </main>
      </div>
      <footer className="govuk-footer">
        <div className="govuk-width-container">
          <div className="govuk-footer__meta">
            <div className="govuk-footer__meta-item govuk-footer__meta-item--grow">
              <span className="govuk-footer__licence-description">
                Workshop Digital Waste Tracking. Collection, delivery and receipt come in later lessons.
              </span>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
