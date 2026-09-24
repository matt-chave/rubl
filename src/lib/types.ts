/**
 * Shared domain types for the Digital Waste Tracking write path.
 *
 * Public IDs (movementId, deliveryId, wasteTrackingId) are the only
 * identifiers callers ever see. Internal event UUIDs stay on the ledger.
 */

export type EventType =
  | 'MOVEMENT_CREATED'
  | 'MOVEMENT_UPDATED'
  | 'MOVEMENT_DELETED'
  | 'MOVEMENT_RESTORED'
  | 'WASTE_COLLECTED'
  | 'COLLECTION_UPDATED'
  | 'COLLECTION_DELETED'
  | 'COLLECTION_RESTORED'
  | 'DELIVERY_RECORDED'
  | 'DELIVERY_DELETED'
  | 'DELIVERY_RESTORED'
  | 'WASTE_RECEIVED'
  | 'RECEIPT_UPDATED'
  | 'RECEIPT_WITHOUT_DELIVERY'
  | 'LEGACY_RECEIPT_CREATED'
  | 'LEGACY_RECEIPT_UPDATED'

/**
 * Canonical envelope published onto EventBridge (and therefore onto
 * Kinesis / the charging queue). `payload` is the accepted OpenAPI body
 * as a JSON object. Firehose lands that envelope as bronze JSON; a later
 * Glue job writes silver Parquet. Do not stringify here for the lake.
 */
export interface MovementEventEnvelope {
  eventType: EventType
  eventId: string
  occurredAt: string
  publicId: string
  apiCode: string
  /** Accepted API body. Object on the ledger, the bus, and bronze JSON. */
  payload: Record<string, unknown>
  /** Waste operator resolved from the API key. Recording, not a pairing grant. */
  operatorId?: string
  /** Cognito app client that submitted. Recording, not authorising. */
  softwareApplicationId?: string
}

export type EntityType = 'MOVEMENT' | 'DELIVERY' | 'RECEIPT' | 'LEGACY_RECEIPT'

export type ItemType = 'EVENT' | 'CURRENT' | 'HISTORY'

export interface ValidationIssue {
  key: string
  errorType:
    | 'NotProvided'
    | 'NotAllowed'
    | 'InvalidType'
    | 'InvalidFormat'
    | 'InvalidValue'
    | 'OutOfRange'
    | 'BusinessRuleViolation'
    | 'IdNotReserved'
  message: string
}

export type ReservationKind = 'MOVEMENT' | 'DELIVERY'
export type ReservationStatus = 'RESERVED' | 'CONSUMED'

export interface ReservationItem {
  PK: string
  kind: ReservationKind
  status: ReservationStatus
  /** Operator that owns the unused ID and the circulation cap. */
  ownerOperatorId: string
  /** Software that reserved the ID. Audit only; claim matches the operator. */
  reservedByClientId: string
  expiresAt: string
  reservedAt: string
  ttl?: number
  gsi1pk?: string
  gsi1sk?: string
}

export interface CurrentRecord {
  PK: string
  SK: string
  itemType: ItemType
  entityType: EntityType
  publicId: string
  apiCode: string
  isDeleted: boolean
  revision: number
  hasCollection: boolean
  hasDelivery: boolean
  hasReceipt: boolean
  isHazardous: boolean
  collectionSequence: CollectionSequenceEntry[]
  movementIds: string[]
  payload: Record<string, unknown>
  createdAt: string
  updatedAt: string
  wasteTrackingId?: string
  gsi1pk?: string
}

export interface CollectionSequenceEntry {
  collectionType: 'STATIC' | 'TRANSIT'
  isDeleted: boolean
  recordedAt: string
  payload: Record<string, unknown>
}

export interface EventRecord {
  PK: string
  SK: string
  itemType: 'EVENT'
  eventType: EventType
  eventId: string
  occurredAt: string
  publicId: string
  apiCode: string
  payload: Record<string, unknown>
  gsi1pk: string
  /** Waste operator resolved from the API key. */
  operatorId?: string
  /** Cognito app client that submitted. Recording, not authorising. */
  softwareApplicationId?: string
}

/** Lifecycle writes billed once. Keep this list in sync with CHARGEABLE in charging-stack.ts. */
export const CHARGEABLE_EVENT_TYPES: ReadonlySet<EventType> = new Set([
  'MOVEMENT_CREATED',
  'WASTE_COLLECTED',
  'DELIVERY_RECORDED',
  'WASTE_RECEIVED',
  'RECEIPT_WITHOUT_DELIVERY',
  'LEGACY_RECEIPT_CREATED',
])
