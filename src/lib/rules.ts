/**
 * Cross-field business rules that OpenAPI 3.0 cannot express.
 *
 * These run *after* structural validation. Failures are BusinessRuleViolation
 * or NotAllowed so vendors see the same errorType vocabulary as Phase 1.
 */

import { NotFoundError, ValidationError, issue } from './errors'
import type { CollectionSequenceEntry, CurrentRecord } from './types'

export function rejectCreateDeleteFlag(body: Record<string, unknown>, fieldPath = 'isDeleted'): void {
  if (body.isDeleted === true) {
    throw new ValidationError([
      issue(fieldPath, 'NotAllowed', 'isDeleted must not be supplied as true on create; use the corresponding PUT'),
    ])
  }
}

export function requireMovement(current: CurrentRecord | undefined): CurrentRecord {
  if (!current || current.entityType !== 'MOVEMENT') {
    throw new NotFoundError('MOVEMENT_NOT_FOUND', 'Movement not found')
  }
  return current
}

export function requireDelivery(current: CurrentRecord | undefined): CurrentRecord {
  if (!current || current.entityType !== 'DELIVERY') {
    throw new NotFoundError('DELIVERY_NOT_FOUND', 'Delivery not found')
  }
  return current
}

export function assertNotDeleted(current: CurrentRecord, action: string): void {
  if (current.isDeleted) {
    throw new ValidationError([
      issue('isDeleted', 'BusinessRuleViolation', `Cannot ${action} while the record is deleted`),
    ])
  }
}

export function assertCanSoftDeleteMovement(current: CurrentRecord): void {
  if (current.hasCollection) {
    throw new ValidationError([
      issue(
        'isDeleted',
        'BusinessRuleViolation',
        'A Movement cannot be deleted once a Collection has been recorded against it',
      ),
    ])
  }
}

export function assertCollectionOpen(current: CurrentRecord): void {
  if (current.hasDelivery) {
    throw new ValidationError([
      issue(
        'movementId',
        'BusinessRuleViolation',
        'Collection sequence is closed because this Movement is named on a Delivery',
      ),
    ])
  }
}

export function nextCollectionType(sequence: CollectionSequenceEntry[]): 'STATIC' | 'TRANSIT' {
  const active = sequence.filter((e) => !e.isDeleted)
  return active.length === 0 ? 'STATIC' : 'TRANSIT'
}

export function assertCollectionType(
  requested: 'STATIC' | 'TRANSIT' | undefined,
  expected: 'STATIC' | 'TRANSIT',
): void {
  const actual = requested ?? 'STATIC'
  if (actual !== expected) {
    throw new ValidationError([
      issue(
        'collectionType',
        'BusinessRuleViolation',
        `Next collection event must be ${expected}`,
      ),
    ])
  }
}

export function latestActiveCollection(sequence: CollectionSequenceEntry[]): CollectionSequenceEntry | undefined {
  for (let i = sequence.length - 1; i >= 0; i -= 1) {
    if (!sequence[i].isDeleted) {
      return sequence[i]
    }
  }
  return undefined
}

export function assertCanSoftDeleteCollection(sequence: CollectionSequenceEntry[], deleting: boolean): void {
  if (!deleting) {
    return
  }
  const active = sequence.filter((e) => !e.isDeleted)
  if (active.length === 0) {
    return
  }
  // STATIC head can only be deleted when it is the sole remaining active event.
  const latest = active[active.length - 1]
  if (latest.collectionType === 'STATIC' && active.length !== 1) {
    throw new ValidationError([
      issue(
        'isDeleted',
        'BusinessRuleViolation',
        'The STATIC collection head can only be deleted when it is the sole remaining event',
      ),
    ])
  }
}

export function assertMovementDeliverable(current: CurrentRecord, movementId: string): void {
  requireMovement(current)
  if (current.isDeleted) {
    throw new ValidationError([
      issue(
        'movementIds',
        'BusinessRuleViolation',
        `Movement ${movementId} is deleted and cannot be named on a Delivery`,
      ),
    ])
  }
  const collectionDeleted =
    current.hasCollection &&
    current.collectionSequence.filter((e) => !e.isDeleted).length === 0
  if (collectionDeleted) {
    throw new ValidationError([
      issue(
        'movementIds',
        'BusinessRuleViolation',
        `Movement ${movementId} has a deleted Collection and cannot be named on a Delivery`,
      ),
    ])
  }
}

export function assertCanSoftDeleteDelivery(current: CurrentRecord): void {
  if (current.hasReceipt) {
    throw new ValidationError([
      issue(
        'isDeleted',
        'BusinessRuleViolation',
        'A Delivery cannot be deleted once a Receipt has been recorded against it',
      ),
    ])
  }
}

export function requireCollectionRecorded(current: CurrentRecord): void {
  if (!current.hasCollection) {
    throw new NotFoundError(
      'COLLECTION_NOT_RECORDED',
      'No collection has been recorded for this movement yet',
    )
  }
}

export function requireReceiptRecorded(current: CurrentRecord): void {
  if (!current.hasReceipt) {
    throw new NotFoundError(
      'RECEIPT_NOT_RECORDED',
      'No receipt has been recorded for this delivery yet',
    )
  }
}
