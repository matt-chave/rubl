import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { assembleSoftwareProviderBody, validateSoftwareProviderSlice } from '../src/validate'

describe('validateSoftwareProviderSlice', () => {
  it('requires product name and a valid contact email', () => {
    assert.deepEqual(
      validateSoftwareProviderSlice({}).map((i) => i.id),
      ['productName', 'contactEmail'],
    )
    assert.deepEqual(
      validateSoftwareProviderSlice({
        productName: 'Haulier Desk',
        contactEmail: 'not-an-email',
      }).map((i) => i.id),
      ['contactEmail'],
    )
    assert.equal(
      validateSoftwareProviderSlice({
        productName: 'Haulier Desk',
        contactEmail: 'devex@example.com',
      }).length,
      0,
    )
  })
})

describe('assembleSoftwareProviderBody', () => {
  it('trims fields for the BFF', () => {
    assert.deepEqual(
      assembleSoftwareProviderBody({
        productName: '  Haulier Desk  ',
        contactEmail: '  devex@example.com ',
      }),
      { productName: 'Haulier Desk', contactEmail: 'devex@example.com' },
    )
  })
})
