/**
 * POST/PUT /movements/{movementId}/collection
 *
 * Collection is an ordered sequence on the Movement: one STATIC pickup
 * followed by zero or more TRANSIT handovers. POST appends; PUT only
 * corrects or tail-peels the latest *active* event. The sequence closes
 * once the Movement is named on a Delivery.
 */

import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { HandlerResult } from '../http'
import { pathParam, validationEnvelope } from '../http'
import { callerAudit } from '../identity'
import { getCurrent, movementPk, newEvent, reviseAggregate } from '../ledger'
import {
  assertCollectionOpen,
  assertCollectionType,
  assertCanSoftDeleteCollection,
  assertNotDeleted,
  latestActiveCollection,
  nextCollectionType,
  rejectCreateDeleteFlag,
  requireCollectionRecorded,
  requireMovement,
} from '../rules'
import type { CollectionSequenceEntry, CurrentRecord, EventType } from '../types'
import { validateOperation } from '../validation'

export async function recordCollection(
  event: APIGatewayProxyEvent,
  body: Record<string, unknown>,
): Promise<HandlerResult> {
  const movementId = pathParam(event, 'movementId')
  const { warnings } = validateOperation('recordCollection', body)
  rejectCreateDeleteFlag(body)

  const previous = requireMovement(await getCurrent(movementPk(movementId)))
  assertNotDeleted(previous, 'record a collection')
  assertCollectionOpen(previous)

  const expected = nextCollectionType(previous.collectionSequence)
  const requested = (body.collectionType as 'STATIC' | 'TRANSIT' | undefined) ?? 'STATIC'
  assertCollectionType(requested, expected)

  const now = new Date().toISOString()
  const entry: CollectionSequenceEntry = {
    collectionType: expected,
    isDeleted: false,
    recordedAt: now,
    payload: body,
  }
  const next: CurrentRecord = {
    ...previous,
    hasCollection: true,
    collectionSequence: [...previous.collectionSequence, entry],
    revision: previous.revision + 1,
    updatedAt: now,
    apiCode: String(body.apiCode),
  }
  const domainEvent = newEvent({
    pk: previous.PK,
    eventType: 'WASTE_COLLECTED',
    publicId: movementId,
    apiCode: String(body.apiCode),
    payload: { movementId, collectionType: expected, ...body },
    occurredAt: String(body.actualDateTimeCollected ?? now),
    ...(await callerAudit(event)),
  })
  await reviseAggregate(previous, next, domainEvent)

  return { statusCode: 201, body: validationEnvelope(warnings) }
}

export async function updateCollection(
  event: APIGatewayProxyEvent,
  body: Record<string, unknown>,
): Promise<HandlerResult> {
  const movementId = pathParam(event, 'movementId')
  const { warnings } = validateOperation('updateCollection', body)

  const previous = requireMovement(await getCurrent(movementPk(movementId)))
  requireCollectionRecorded(previous)
  assertCollectionOpen(previous)

  const deleting = body.isDeleted === true
  assertCanSoftDeleteCollection(previous.collectionSequence, deleting)

  const latest = latestActiveCollection(previous.collectionSequence)
  if (!latest) {
    requireCollectionRecorded({ ...previous, hasCollection: false })
  }

  const now = new Date().toISOString()
  const sequence = previous.collectionSequence.map((entry) => ({ ...entry }))
  // PUT acts on the latest active event only (OpenAPI: correcting earlier events is out of scope).
  for (let i = sequence.length - 1; i >= 0; i -= 1) {
    if (!sequence[i].isDeleted) {
      sequence[i] = {
        ...sequence[i],
        payload: body,
        isDeleted: deleting ? true : body.isDeleted === false ? false : sequence[i].isDeleted,
      }
      break
    }
  }

  const stillHasActive = sequence.some((e) => !e.isDeleted)
  const next: CurrentRecord = {
    ...previous,
    collectionSequence: sequence,
    hasCollection: stillHasActive,
    revision: previous.revision + 1,
    updatedAt: now,
    apiCode: String(body.apiCode),
  }

  let eventType: EventType = 'COLLECTION_UPDATED'
  if (deleting && latest && !latest.isDeleted) {
    eventType = 'COLLECTION_DELETED'
  } else if (body.isDeleted === false && latest?.isDeleted) {
    eventType = 'COLLECTION_RESTORED'
  }

  const domainEvent = newEvent({
    pk: previous.PK,
    eventType,
    publicId: movementId,
    apiCode: String(body.apiCode),
    payload: { movementId, ...body },
    ...(await callerAudit(event)),
  })
  await reviseAggregate(previous, next, domainEvent)

  return { statusCode: 200, body: validationEnvelope(warnings) }
}
