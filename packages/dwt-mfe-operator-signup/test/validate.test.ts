import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { assembleOperatorBody, validateOperatorSlice } from '../src/validate'

describe('validateOperatorSlice', () => {
  it('requires organisation name, address, and a valid contact email', () => {
    assert.deepEqual(
      validateOperatorSlice({}).map((i) => i.id),
      ['organisationName', 'address', 'contactEmail'],
    )
    assert.equal(
      validateOperatorSlice({
        organisationName: 'Acme Waste Ltd',
        address: '1 Depot Road, London',
        contactEmail: 'ops@acme.example',
      }).length,
      0,
    )
  })
})

describe('assembleOperatorBody', () => {
  it('trims fields for the BFF', () => {
    assert.deepEqual(
      assembleOperatorBody({
        organisationName: '  Acme Waste Ltd ',
        address: ' 1 Depot Road ',
        contactEmail: ' ops@acme.example ',
      }),
      {
        organisationName: 'Acme Waste Ltd',
        address: '1 Depot Road',
        contactEmail: 'ops@acme.example',
      },
    )
  })
})
