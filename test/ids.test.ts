import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mintPublicId, mintWasteTrackingId, yearPrefix } from '../src/lib/ids'

describe('public IDs', () => {
  it('mints a year-prefixed uppercase sqid', () => {
    const id = mintPublicId(1, new Date('2025-09-15T00:00:00Z'))
    assert.equal(id.slice(0, 2), '25')
    assert.match(id, /^[0-9A-Z]+$/)
    assert.ok(id.length >= 8)
  })

  it('uses the UTC year', () => {
    assert.equal(yearPrefix(new Date('2026-01-01T00:00:00Z')), '26')
  })

  it('mints Phase 1 wasteTrackingId as two letters plus six alphanumerics', () => {
    const id = mintWasteTrackingId(42)
    assert.match(id, /^[A-Z]{2}[A-Z0-9]{6}$/)
    assert.equal(id.slice(0, 2), 'WT')
  })
})
