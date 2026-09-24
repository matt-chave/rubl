import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ConflictError, ValidationError } from '../src/lib/errors'
import { parseJsonBody, json, apiHandler } from '../src/lib/http'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { nextCollectionType, rejectCreateDeleteFlag } from '../src/lib/rules'

function event(body: string, base64 = false): APIGatewayProxyEvent {
  return { body, isBase64Encoded: base64 } as APIGatewayProxyEvent
}

describe('HTTP adapter', () => {
  it('parses a JSON object body', () => {
    const parsed = parseJsonBody(event('{"apiCode":"abc"}'))
    assert.equal(parsed.apiCode, 'abc')
  })

  it('rejects invalid JSON as InvalidFormat', () => {
    assert.throws(
      () => parseJsonBody(event('{')),
      (err: unknown) => {
        assert.ok(err instanceof ValidationError)
        assert.equal(err.issues[0].errorType, 'InvalidFormat')
        return true
      },
    )
  })

  it('serialises JSON responses', () => {
    const res = json(201, { movementId: '25HRA0B2' })
    assert.equal(res.statusCode, 201)
    assert.equal(JSON.parse(res.body).movementId, '25HRA0B2')
  })

  it('maps ConflictError to 409', async () => {
    const handler = apiHandler(async () => {
      throw new ConflictError('ALREADY_EXISTS', 'Movement 26HRA0B2 already exists')
    })
    const res = await handler(event('{}'))
    assert.equal(res.statusCode, 409)
    assert.equal(JSON.parse(res.body).code, 'ALREADY_EXISTS')
  })
})

describe('business rules', () => {
  it('rejects isDeleted true on create', () => {
    assert.throws(
      () => rejectCreateDeleteFlag({ isDeleted: true }),
      (err: unknown) => err instanceof ValidationError && err.issues[0].errorType === 'NotAllowed',
    )
  })

  it('expects STATIC then TRANSIT on the collection sequence', () => {
    assert.equal(nextCollectionType([]), 'STATIC')
    assert.equal(
      nextCollectionType([
        { collectionType: 'STATIC', isDeleted: false, recordedAt: '', payload: {} },
      ]),
      'TRANSIT',
    )
  })
})
