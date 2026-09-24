import type { CreateMovementBody, CreateMovementResult, FlushResult, QueueStore, ReserveResponse } from './types'

export function attachMovementId(body: CreateMovementBody, movementId: string): CreateMovementBody {
  return { ...body, movementId }
}

export async function ensureReservedIds(
  store: QueueStore,
  reserve: (movementCount: number) => Promise<ReserveResponse>,
  options: { min?: number; batch?: number; isOnline: () => boolean },
): Promise<{ ids: string[]; reservedNow: number }> {
  const min = options.min ?? 1
  const batch = options.batch ?? 5
  const existing = await store.getReservedIds()
  if (existing.length >= min) {
    return { ids: existing, reservedNow: 0 }
  }
  if (!options.isOnline()) {
    return { ids: existing, reservedNow: 0 }
  }
  const needed = Math.max(batch, min - existing.length)
  const response = await reserve(needed)
  const ids = response.movementIds ?? []
  if (ids.length > 0) {
    await store.addReservedIds(ids)
  }
  return { ids: await store.getReservedIds(), reservedNow: ids.length }
}

export async function submitOrQueue(
  store: QueueStore,
  body: CreateMovementBody,
  deps: {
    isOnline: () => boolean
    postMovement: (payload: CreateMovementBody) => Promise<unknown>
  },
): Promise<CreateMovementResult> {
  if (!deps.isOnline()) {
    const movementId = await store.takeReservedId()
    if (!movementId) {
      throw new Error('No reserved movement IDs. Connect to the network and open this page so we can reserve IDs first.')
    }
    const queued = attachMovementId(body, movementId)
    await store.enqueue({
      localId: `${Date.now()}-${movementId}`,
      movementId,
      body: queued,
      queuedAt: new Date().toISOString(),
    })
    return { queued: true, movementId }
  }

  // Online create omits movementId so the API mints a fresh public id.
  // Reserved ids stay in the pool for offline submit (and flush claims them later).
  const response = await deps.postMovement(body)
  const minted =
    response && typeof response === 'object' && 'movementId' in response
      ? String((response as { movementId: unknown }).movementId)
      : undefined
  return { queued: false, movementId: minted, response }
}

export async function flushQueue(
  store: QueueStore,
  deps: {
    isOnline: () => boolean
    postMovement: (payload: CreateMovementBody) => Promise<unknown>
  },
): Promise<FlushResult> {
  if (!deps.isOnline()) {
    const remaining = (await store.list()).length
    return { sent: 0, remaining, skipped: true }
  }
  const items = await store.list()
  let sent = 0
  for (const item of items) {
    await deps.postMovement(attachMovementId(item.body, item.movementId))
    await store.remove(item.localId)
    sent += 1
  }
  return { sent, remaining: (await store.list()).length, skipped: false }
}
