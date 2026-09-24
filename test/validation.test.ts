import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ValidationError } from '../src/lib/errors'
import { validateOperation } from '../src/lib/validation'

const validCreate = {
  apiCode: '25b14080-5e77-4f91-9957-2482a0cb8775',
  plannedCollectionTime: '2025-09-15T08:00:00Z',
  producer: {
    wasteSource: 'Commercial',
    organisationName: 'Test Producer Ltd',
    sicCode: '38110',
    authorisationNumber: 'EPR/AB1234CD',
    emailAddress: 'producer@example.co.uk',
    address: { fullAddress: '1 Test Street, London', postcode: 'SW1A 1AA' },
  },
  intendedCarriers: [
    {
      meansOfTransport: 'Road',
      organisationName: 'Test Carrier Ltd',
      emailAddress: 'carrier@example.co.uk',
    },
  ],
  wasteItems: [
    {
      weight: { metric: 'Tonnes', amount: 1.5, isEstimate: true },
      numberOfContainers: 2,
      typeOfContainers: 'SKI',
      physicalForm: 'Solid',
      classification: {
        ewcCodes: ['200108'],
        wasteDescription: 'Kitchen waste',
        containsPops: false,
        containsHazardous: false,
      },
      intendedTreatments: [
        { disposalOrRecoveryCode: 'R3', weight: { metric: 'Tonnes', amount: 1.5, isEstimate: true } },
      ],
    },
  ],
}

describe('createMovement validation', () => {
  it('accepts a structurally valid payload', () => {
    const result = validateOperation('createMovement', validCreate)
    assert.equal(result.warnings.length, 0)
  })

  it('rejects a missing apiCode as NotProvided', () => {
    const { apiCode: _omit, ...body } = validCreate
    assert.throws(
      () => validateOperation('createMovement', body),
      (err: unknown) => {
        assert.ok(err instanceof ValidationError)
        assert.equal(err.issues[0].errorType, 'NotProvided')
        assert.equal(err.issues[0].key, 'apiCode')
        return true
      },
    )
  })

  it('accepts an optional reserved movementId', () => {
    const result = validateOperation('createMovement', { ...validCreate, movementId: '26HRA0B2' })
    assert.equal(result.warnings.length, 0)
  })

  it('rejects an empty reserved movementId', () => {
    assert.throws(
      () => validateOperation('createMovement', { ...validCreate, movementId: '' }),
      (err: unknown) => err instanceof ValidationError && err.issues.some((i) => i.key === 'movementId'),
    )
  })

  it('rejects isDeleted on the wrong operation via NotAllowed in updateDelivery extra fields', () => {
    assert.throws(
      () =>
        validateOperation('updateDelivery', {
          apiCode: validCreate.apiCode,
          isDeleted: true,
          carrier: { organisationName: 'nope' },
        }),
      (err: unknown) => {
        assert.ok(err instanceof ValidationError)
        assert.ok(err.issues.some((i) => i.errorType === 'NotAllowed' && i.key === 'carrier'))
        return true
      },
    )
  })
})
