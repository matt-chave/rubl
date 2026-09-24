import type { QueueStore, QueuedMovement } from './types'

const KEY_IDS = 'dwt.reservedMovementIds'
const KEY_QUEUE = 'dwt.offlineQueue'

export function createMemoryStore(seed?: { ids?: string[]; queue?: QueuedMovement[] }): QueueStore {
  let ids = [...(seed?.ids ?? [])]
  let queue = [...(seed?.queue ?? [])]
  return {
    async getReservedIds() {
      return [...ids]
    },
    async addReservedIds(extra) {
      ids = [...ids, ...extra]
    },
    async takeReservedId() {
      return ids.shift()
    },
    async enqueue(item) {
      queue.push(item)
    },
    async list() {
      return [...queue]
    },
    async remove(localId) {
      queue = queue.filter((item) => item.localId !== localId)
    },
  }
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') {
    return fallback
  }
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  localStorage.setItem(key, JSON.stringify(value))
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('dwt-operator', 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function idbGet<T>(key: string, fallback: T): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const request = db.transaction('kv', 'readonly').objectStore('kv').get(key)
    request.onsuccess = () => resolve((request.result as T | undefined) ?? fallback)
    request.onerror = () => reject(request.error)
  })
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const request = db.transaction('kv', 'readwrite').objectStore('kv').put(value, key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export function createIdbStore(): QueueStore {
  return {
    async getReservedIds() {
      return idbGet<string[]>(KEY_IDS, [])
    },
    async addReservedIds(extra) {
      const ids = await idbGet<string[]>(KEY_IDS, [])
      await idbSet(KEY_IDS, [...ids, ...extra])
    },
    async takeReservedId() {
      const ids = await idbGet<string[]>(KEY_IDS, [])
      const next = ids.shift()
      await idbSet(KEY_IDS, ids)
      return next
    },
    async enqueue(item) {
      const queue = await idbGet<QueuedMovement[]>(KEY_QUEUE, [])
      await idbSet(KEY_QUEUE, [...queue, item])
    },
    async list() {
      return idbGet<QueuedMovement[]>(KEY_QUEUE, [])
    },
    async remove(localId) {
      const queue = await idbGet<QueuedMovement[]>(KEY_QUEUE, [])
      await idbSet(
        KEY_QUEUE,
        queue.filter((item) => item.localId !== localId),
      )
    },
  }
}

/**
 * Browser store. Prefers IndexedDB for reserved IDs and the offline
 * queue. Falls back to localStorage, then memory, so unit tests and
 * older browsers still work. The queue API is the same in all cases.
 */
export function createBrowserStore(): QueueStore {
  if (typeof indexedDB !== 'undefined') {
    return createIdbStore()
  }
  if (typeof localStorage === 'undefined') {
    return createMemoryStore()
  }
  return {
    async getReservedIds() {
      return readJson<string[]>(KEY_IDS, [])
    },
    async addReservedIds(extra) {
      writeJson(KEY_IDS, [...readJson<string[]>(KEY_IDS, []), ...extra])
    },
    async takeReservedId() {
      const ids = readJson<string[]>(KEY_IDS, [])
      const next = ids.shift()
      writeJson(KEY_IDS, ids)
      return next
    },
    async enqueue(item) {
      writeJson(KEY_QUEUE, [...readJson<QueuedMovement[]>(KEY_QUEUE, []), item])
    },
    async list() {
      return readJson<QueuedMovement[]>(KEY_QUEUE, [])
    },
    async remove(localId) {
      writeJson(
        KEY_QUEUE,
        readJson<QueuedMovement[]>(KEY_QUEUE, []).filter((item) => item.localId !== localId),
      )
    },
  }
}
