import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { assembleCreateMovementBody, validateCarriersSlice, validateProducerSlice, validateWasteItemsSlice } from '../src/validate.ts'
import { EMPTY_CARRIER, EMPTY_PRODUCER, EMPTY_WASTE_ITEM } from '../src/types.ts'

describe('producer slice', () => {
  it('uses OpenAPI field names on commercial producer errors', () => {
    const issues = validateProducerSlice({ ...EMPTY_PRODUCER, organisationName: '' })
    const ids = issues.map((issue) => issue.id)
    assert.ok(ids.includes('organisationName'))
    assert.ok(ids.includes('sicCode'))
    assert.ok(ids.includes('authorisationNumber'))
    assert.ok(ids.includes('emailAddress'))
    assert.ok(ids.includes('fullAddress'))
    assert.ok(ids.includes('postcode'))
  })

  it('accepts a complete commercial producer', () => {
    const issues = validateProducerSlice({
      wasteSource: 'Commercial',
      organisationName: 'Test Producer Ltd',
      sicCode: '38110',
      authorisationNumber: 'EPR/AB1234CD',
      emailAddress: 'producer@example.co.uk',
      address: { fullAddress: '1 Test Street, London', postcode: 'SW1A 1AA' },
    })
    assert.equal(issues.length, 0)
  })
})

describe('carriers slice', () => {
  it('requires intendedCarriers and organisationName', () => {
    assert.equal(validateCarriersSlice([])[0]?.id, 'intendedCarriers')
    const issues = validateCarriersSlice([{ ...EMPTY_CARRIER }])
    assert.ok(issues.some((issue) => issue.id === 'carrier-0-organisationName'))
  })
})

describe('waste items slice', () => {
  it('requires wasteItems and OpenAPI classification fields', () => {
    assert.equal(validateWasteItemsSlice([])[0]?.id, 'wasteItems')
    const issues = validateWasteItemsSlice([{ ...EMPTY_WASTE_ITEM }])
    const ids = issues.map((issue) => issue.id)
    assert.ok(ids.includes('waste-0-weight'))
    assert.ok(ids.includes('waste-0-ewc'))
    assert.ok(ids.includes('waste-0-description'))
  })
})

describe('assembleCreateMovementBody', () => {
  it('keeps movementId when the host reserved one', () => {
    const body = assembleCreateMovementBody({
      apiCode: '25b14080-5e77-4f91-9957-2482a0cb8775',
      plannedCollectionTime: '2025-09-15T08:00:00Z',
      movementId: '26HRA0B2',
      producer: EMPTY_PRODUCER,
      intendedCarriers: [EMPTY_CARRIER],
      wasteItems: [EMPTY_WASTE_ITEM],
    })
    assert.equal(body.movementId, '26HRA0B2')
    assert.ok('producer' in body)
    assert.ok('intendedCarriers' in body)
    assert.ok('wasteItems' in body)
  })
})
