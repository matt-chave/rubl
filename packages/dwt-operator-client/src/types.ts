export interface CreateMovementBody {
  apiCode: string
  plannedCollectionTime: string
  producer: unknown
  intendedCarriers: unknown[]
  wasteItems: unknown[]
  movementId?: string
}

export interface QueuedMovement {
  localId: string
  movementId: string
  body: CreateMovementBody
  queuedAt: string
}

export interface ReserveResponse {
  movementIds: string[]
  deliveryIds: string[]
  expiresAt?: string
  inCirculation?: number
}

export interface QueueStore {
  getReservedIds(): Promise<string[]>
  addReservedIds(ids: string[]): Promise<void>
  takeReservedId(): Promise<string | undefined>
  enqueue(item: QueuedMovement): Promise<void>
  list(): Promise<QueuedMovement[]>
  remove(localId: string): Promise<void>
}

export interface CreateMovementResult {
  queued: boolean
  movementId?: string
  response?: unknown
}

export interface FlushResult {
  sent: number
  remaining: number
  skipped: boolean
}
