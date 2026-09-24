import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ValidationError } from '../src/lib/errors'
import { requireContactEmail, requireTrimmedString } from '../src/lib/onboarding'

describe('onboarding field helpers', () => {
  it('requires trimmed product and organisation fields', () => {
    assert.equal(requireTrimmedString({ productName: '  Desk  ' }, 'productName', 'product name'), 'Desk')
    assert.throws(
      () => requireTrimmedString({ productName: '   ' }, 'productName', 'product name'),
      (err: unknown) => err instanceof ValidationError && err.issues[0].key === 'productName',
    )
  })

  it('requires a plausible contact email', () => {
    assert.equal(requireContactEmail({ contactEmail: 'ops@acme.example' }), 'ops@acme.example')
    assert.throws(
      () => requireContactEmail({ contactEmail: 'not-an-email' }),
      (err: unknown) => err instanceof ValidationError && err.issues[0].errorType === 'InvalidFormat',
    )
  })
})
