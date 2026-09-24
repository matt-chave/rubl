/**
 * POST/PUT /movements — create and revise a waste movement.
 *
 * Create mints the public Movement ID and writes the first EVENT + CURRENT
 * items. Update snapshots CURRENT to history, increments revision, and
 * appends a new EVENT. Soft-delete is only legal on PUT, and only before
 * a Collection exists.
 */

import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { HandlerResult } from '../http'
import { pathParam, validationEnvelope } from '../http'
import { ConflictError } from '../errors'
import {
  claimReservation,
  getCurrent,
  mintMovementId,
  movementPk,
  newEvent,
  reviseAggregate,
  writeNewAggregate,
} from '../ledger'
import { callerAudit } from '../identity'
import {
  assertCanSoftDeleteMovement,
  rejectCreateDeleteFlag,
  requireMovement,
} from '../rules'
import type { CurrentRecord } from '../types'
import { movementIsHazardous, validateOperation } from '../validation'

function currentFromCreate(movementId: string, body: Record<string, unknown>, now: string): CurrentRecord {
  const apiCode = String(body.apiCode)
  return {
    PK: movementPk(movementId),
    SK: 'CURRENT',
    itemType: 'CURRENT',
    entityType: 'MOVEMENT',
    publicId: movementId,
    apiCode,
    isDeleted: false,
    revision: 1,
    hasCollection: false,
    hasDelivery: false,
    hasReceipt: false,
    isHazardous: movementIsHazardous(body),
    collectionSequence: [],
    movementIds: [],
    payload: body,
    createdAt: now,
    updatedAt: now,
    gsi1pk: `ID#${movementId}`,
  }
}

export async function createMovement(
  event: APIGatewayProxyEvent,
  body: Record<string, unknown>,
): Promise<HandlerResult> {
  const { warnings } = validateOperation('createMovement', body)
  rejectCreateDeleteFlag(body)

  const audit = await callerAudit(event)
  const supplied = typeof body.movementId === 'string' && body.movementId.length > 0 ? body.movementId : undefined
  let movementId: string
  if (supplied) {
    const existing = await getCurrent(movementPk(supplied))
    if (existing) {
      throw new ConflictError('ALREADY_EXISTS', `Movement ${supplied} already exists`)
    }
    await claimReservation(supplied, 'MOVEMENT', audit.operatorId)
    movementId = supplied
  } else {
    movementId = await mintMovementId()
  }
  const now = new Date().toISOString()
  const current = currentFromCreate(movementId, body, now)
  const domainEvent = newEvent({
    pk: current.PK,
    eventType: 'MOVEMENT_CREATED',
    publicId: movementId,
    apiCode: String(body.apiCode),
    payload: { movementId, ...body },
    ...audit,
  })
  await writeNewAggregate(current, domainEvent)

  return {
    statusCode: 201,
    body: { movementId, ...validationEnvelope(warnings) },
  }
}

export async function updateMovement(
  event: APIGatewayProxyEvent,
  body: Record<string, unknown>,
): Promise<HandlerResult> {
  const movementId = pathParam(event, 'movementId')
  const { warnings } = validateOperation('updateMovement', body)
  const previous = requireMovement(await getCurrent(movementPk(movementId)))

  const deleting = body.isDeleted === true
  if (deleting) {
    assertCanSoftDeleteMovement(previous)
  }

  const now = new Date().toISOString()
  const next: CurrentRecord = {
    ...previous,
    payload: body,
    apiCode: String(body.apiCode),
    isDeleted: deleting ? true : body.isDeleted === false ? false : previous.isDeleted,
    isHazardous: movementIsHazardous(body),
    revision: previous.revision + 1,
    updatedAt: now,
  }

  let eventType: 'MOVEMENT_UPDATED' | 'MOVEMENT_DELETED' | 'MOVEMENT_RESTORED' = 'MOVEMENT_UPDATED'
  if (deleting && !previous.isDeleted) {
    eventType = 'MOVEMENT_DELETED'
  } else if (!deleting && previous.isDeleted && body.isDeleted === false) {
    eventType = 'MOVEMENT_RESTORED'
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
