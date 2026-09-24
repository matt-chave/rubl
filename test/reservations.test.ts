import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { ValidationError } from '../src/lib/errors'
import { callerApiKeyId, callerAudit, callerClientId, callerOperatorId, setOperatorLookupForTests } from '../src/lib/identity'
import { mintPublicId } from '../src/lib/ids'
import {
  allocateCirculation,
  assertClaimable,
  ownerReservedGsiPk,
  parseReserveCounts,
  reservationPk,
  reservationWindow,
  reservedDeliveryIdToClaim,
} from '../src/lib/reservations'
import type { ReservationItem } from '../src/lib/types'

function reserved(overrides: Partial<ReservationItem> = {}): ReservationItem {
  return {
    PK: 'ID#26HRA0B2',
    kind: 'MOVEMENT',
    status: 'RESERVED',
    ownerOperatorId: 'OP-SANDBOX-1',
    reservedByClientId: 'software-a',
    expiresAt: '2026-10-22T12:00:00.000Z',
    reservedAt: '2026-09-22T12:00:00.000Z',
    ttl: 1_766_534_400,
    ...overrides,
  }
}

describe('parseReserveCounts', () => {
  it('accepts a valid batch', () => {
    assert.deepEqual(parseReserveCounts({ movementCount: 20, deliveryCount: 10 }), {
      movementCount: 20,
      deliveryCount: 10,
    })
  })

  it('defaults a missing count to 0', () => {
    assert.deepEqual(parseReserveCounts({ movementCount: 1 }), {
      movementCount: 1,
      deliveryCount: 0,
    })
  })

  it('rejects a zero-total batch', () => {
    assert.throws(
      () => parseReserveCounts({}),
      (err: unknown) => err instanceof ValidationError && err.issues[0].errorType === 'OutOfRange',
    )
  })

  it('accepts a request larger than 50 (circulation cap applied later)', () => {
    assert.deepEqual(parseReserveCounts({ movementCount: 80, deliveryCount: 0 }), {
      movementCount: 80,
      deliveryCount: 0,
    })
  })

  it('rejects a non-integer count', () => {
    assert.throws(
      () => parseReserveCounts({ movementCount: 1.5 }),
      (err: unknown) => err instanceof ValidationError && err.issues[0].key === 'movementCount',
    )
  })

  it('rejects a negative count', () => {
    assert.throws(
      () => parseReserveCounts({ movementCount: -1 }),
      (err: unknown) => err instanceof ValidationError && err.issues[0].errorType === 'OutOfRange',
    )
  })
})

describe('assertClaimable', () => {
  const now = new Date('2026-09-22T12:00:00.000Z')

  it('accepts a reserved id owned by the operator', () => {
    assert.doesNotThrow(() =>
      assertClaimable(reserved(), { kind: 'MOVEMENT', ownerOperatorId: 'OP-SANDBOX-1', now }),
    )
  })

  it('rejects a missing reservation', () => {
    assert.throws(
      () => assertClaimable(undefined, { kind: 'MOVEMENT', ownerOperatorId: 'OP-SANDBOX-1', now }),
      (err: unknown) => err instanceof ValidationError && err.issues[0].errorType === 'IdNotReserved',
    )
  })

  it('rejects the wrong operator', () => {
    assert.throws(
      () => assertClaimable(reserved(), { kind: 'MOVEMENT', ownerOperatorId: 'OP-OTHER', now }),
      (err: unknown) => err instanceof ValidationError && err.issues[0].errorType === 'IdNotReserved',
    )
  })

  it('does not treat reservedByClientId as ownership', () => {
    assert.doesNotThrow(() =>
      assertClaimable(reserved({ reservedByClientId: 'software-b' }), {
        kind: 'MOVEMENT',
        ownerOperatorId: 'OP-SANDBOX-1',
        now,
      }),
    )
  })

  it('rejects an expired reservation', () => {
    assert.throws(
      () =>
        assertClaimable(reserved({ expiresAt: '2026-09-01T00:00:00.000Z' }), {
          kind: 'MOVEMENT',
          ownerOperatorId: 'OP-SANDBOX-1',
          now,
        }),
      (err: unknown) => err instanceof ValidationError && err.issues[0].message.includes('expired'),
    )
  })

  it('rejects an already consumed id', () => {
    assert.throws(
      () =>
        assertClaimable(reserved({ status: 'CONSUMED' }), {
          kind: 'MOVEMENT',
          ownerOperatorId: 'OP-SANDBOX-1',
          now,
        }),
      (err: unknown) => err instanceof ValidationError && err.issues[0].errorType === 'IdNotReserved',
    )
  })
})

describe('allocateCirculation', () => {
  it('gives a full ask when nothing is in circulation', () => {
    assert.deepEqual(allocateCirculation({ movementCount: 20, deliveryCount: 10 }, 0), {
      movementCount: 20,
      deliveryCount: 10,
    })
  })

  it('caps an ask of 50 when 10 are already unused', () => {
    assert.deepEqual(allocateCirculation({ movementCount: 50, deliveryCount: 0 }, 10), {
      movementCount: 40,
      deliveryCount: 0,
    })
  })

  it('returns at most 50 even if they ask for more', () => {
    assert.deepEqual(allocateCirculation({ movementCount: 80, deliveryCount: 20 }, 0), {
      movementCount: 50,
      deliveryCount: 0,
    })
  })

  it('fills movements first then deliveries from the remaining quota', () => {
    assert.deepEqual(allocateCirculation({ movementCount: 30, deliveryCount: 20 }, 10), {
      movementCount: 30,
      deliveryCount: 10,
    })
  })

  it('returns nothing when 50 are already in circulation', () => {
    assert.deepEqual(allocateCirculation({ movementCount: 10, deliveryCount: 10 }, 50), {
      movementCount: 0,
      deliveryCount: 0,
    })
  })
})

describe('reservedDeliveryIdToClaim', () => {
  it('claims a reserved delivery id for the non-hazardous group', () => {
    assert.equal(reservedDeliveryIdToClaim('26KMT4Z9', 2), '26KMT4Z9')
  })

  it('ignores a reserved delivery id when every movement is hazardous', () => {
    assert.equal(reservedDeliveryIdToClaim('26KMT4Z9', 0), undefined)
  })
})

describe('reservation helpers', () => {
  it('builds ID# keys and a 30-day window', () => {
    assert.equal(reservationPk('26HRA0B2'), 'ID#26HRA0B2')
    assert.equal(ownerReservedGsiPk('OP-SANDBOX-1'), 'OWNER#OP-SANDBOX-1#RESERVED')
    const window = reservationWindow(new Date('2026-09-22T00:00:00.000Z'), 30)
    assert.equal(window.expiresAt, '2026-10-22T00:00:00.000Z')
  })
})

describe('caller identities', () => {
  afterEach(() => {
    delete process.env.SANDBOX_API_KEY_ID
    delete process.env.SANDBOX_OPERATOR_ID
    delete process.env.OPERATORS_TABLE
    setOperatorLookupForTests(undefined)
  })

  it('reads client_id from Cognito authorizer claims', () => {
    const event = {
      requestContext: { authorizer: { claims: { client_id: 'software-a' } } },
    } as unknown as APIGatewayProxyEvent
    assert.equal(callerClientId(event), 'software-a')
  })

  it('reads apiKeyId from the request context', () => {
    const event = {
      requestContext: { identity: { apiKeyId: 'key-1' } },
    } as unknown as APIGatewayProxyEvent
    assert.equal(callerApiKeyId(event), 'key-1')
  })

  it('resolves the seeded operator from the matching API key', async () => {
    process.env.SANDBOX_API_KEY_ID = 'key-1'
    process.env.SANDBOX_OPERATOR_ID = 'OP-SANDBOX-1'
    const event = {
      requestContext: {
        authorizer: { claims: { client_id: 'software-a' } },
        identity: { apiKeyId: 'key-1' },
      },
    } as unknown as APIGatewayProxyEvent
    assert.equal(await callerOperatorId(event), 'OP-SANDBOX-1')
    assert.deepEqual(await callerAudit(event), {
      operatorId: 'OP-SANDBOX-1',
      softwareApplicationId: 'software-a',
    })
  })

  it('resolves a non-sandbox API key via the onboarding lookup', async () => {
    process.env.SANDBOX_API_KEY_ID = 'key-1'
    setOperatorLookupForTests(async (apiKeyId) =>
      apiKeyId === 'key-from-signup' ? 'OP-ACME-1' : undefined,
    )
    const event = {
      requestContext: { identity: { apiKeyId: 'key-from-signup' } },
    } as unknown as APIGatewayProxyEvent
    assert.equal(await callerOperatorId(event), 'OP-ACME-1')
  })

  it('rejects an API key that is not mapped to an operator', async () => {
    process.env.SANDBOX_API_KEY_ID = 'key-1'
    setOperatorLookupForTests(async () => undefined)
    const event = {
      requestContext: { identity: { apiKeyId: 'key-other' } },
    } as unknown as APIGatewayProxyEvent
    await assert.rejects(
      () => callerOperatorId(event),
      (err: unknown) => err instanceof ValidationError && err.issues[0].errorType === 'NotAllowed',
    )
  })

  it('does not read X-Operator-Id as identity', async () => {
    process.env.SANDBOX_API_KEY_ID = 'key-1'
    process.env.SANDBOX_OPERATOR_ID = 'OP-SANDBOX-1'
    const event = {
      headers: { 'X-Operator-Id': 'OP-SPOOFED' },
      requestContext: {
        authorizer: { claims: { client_id: 'software-a' } },
        identity: { apiKeyId: 'key-1' },
      },
    } as unknown as APIGatewayProxyEvent
    assert.equal(await callerOperatorId(event), 'OP-SANDBOX-1')
  })
})

describe('online mint uniqueness vs reservation encoding', () => {
  it('distinct sequence numbers encode to distinct public ids', () => {
    const now = new Date('2026-09-22T00:00:00.000Z')
    const a = mintPublicId(100, now)
    const b = mintPublicId(101, now)
    assert.notEqual(a, b)
    assert.match(a, /^26[0-9A-Z]+$/)
  })
})
