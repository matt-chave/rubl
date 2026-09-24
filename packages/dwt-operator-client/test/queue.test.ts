import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { attachMovementId, flushQueue, submitOrQueue } from '../src/queue.ts'
import { createMemoryStore } from '../src/store.ts'
import type { CreateMovementBody } from '../src/types.ts'

const body: CreateMovementBody = {
  apiCode: '25b14080-5e77-4f91-9957-2482a0cb8775',
  plannedCollectionTime: '2025-09-15T08:00:00Z',
  producer: { organisationName: 'Test Producer Ltd' },
  intendedCarriers: [{ organisationName: 'Test Carrier Ltd' }],
  wasteItems: [{ classification: { wasteDescription: 'Kitchen waste' } }],
}

describe('attachMovementId', () => {
  it('puts the reserved public id on the create body', () => {
    assert.equal(attachMovementId(body, '26HRA0B2').movementId, '26HRA0B2')
  })
})

describe('submitOrQueue', () => {
  it('queues with a reserved movementId while offline and does not fetch', async () => {
    const store = createMemoryStore({ ids: ['26HRA0B2'] })
    let fetched = 0
    const result = await submitOrQueue(store, body, {
      isOnline: () => false,
      postMovement: async () => {
        fetched += 1
        return {}
      },
    })
    assert.equal(result.queued, true)
    assert.equal(result.movementId, '26HRA0B2')
    assert.equal(fetched, 0)
    assert.equal((await store.list())[0]?.movementId, '26HRA0B2')
    assert.equal((await store.getReservedIds()).length, 0)
  })

  it('posts without movementId while online and leaves the reserved pool intact', async () => {
    const store = createMemoryStore({ ids: ['26HRA0B2'] })
    const posted: CreateMovementBody[] = []
    const result = await submitOrQueue(store, body, {
      isOnline: () => true,
      postMovement: async (payload) => {
        posted.push(payload)
        return { movementId: '26API0NEW' }
      },
    })
    assert.equal(result.queued, false)
    assert.equal(posted[0]?.movementId, undefined)
    assert.equal(result.movementId, '26API0NEW')
    assert.deepEqual(await store.getReservedIds(), ['26HRA0B2'])
  })
})

describe('flushQueue', () => {
  it('does not call fetch while offline', async () => {
    const store = createMemoryStore({
      queue: [
        {
          localId: '1',
          movementId: '26HRA0B2',
          body: attachMovementId(body, '26HRA0B2'),
          queuedAt: '2026-09-23T12:00:00Z',
        },
      ],
    })
    let fetched = 0
    const result = await flushQueue(store, {
      isOnline: () => false,
      postMovement: async () => {
        fetched += 1
        return {}
      },
    })
    assert.equal(result.skipped, true)
    assert.equal(result.sent, 0)
    assert.equal(result.remaining, 1)
    assert.equal(fetched, 0)
  })

  it('flushes reserved movementId when online', async () => {
    const store = createMemoryStore({
      queue: [
        {
          localId: '1',
          movementId: '26HRA0B2',
          body: body,
          queuedAt: '2026-09-23T12:00:00Z',
        },
      ],
    })
    const posted: CreateMovementBody[] = []
    const result = await flushQueue(store, {
      isOnline: () => true,
      postMovement: async (payload) => {
        posted.push(payload)
        return {}
      },
    })
    assert.equal(result.skipped, false)
    assert.equal(result.sent, 1)
    assert.equal(result.remaining, 0)
    assert.equal(posted[0]?.movementId, '26HRA0B2')
  })
})
