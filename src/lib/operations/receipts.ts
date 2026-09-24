/**
 * Receipt endpoints — Phase 2 (against a Delivery), POST /receipts
 * (no prior delivery), and the deprecated Phase 1 /movements/receive pair.
 *
 * A receipt is the terminal event: it has no isDeleted. Corrections go
 * through PUT, which snapshots then revises like every other update.
 */

import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { HandlerResult } from '../http'
import { pathParam, validationEnvelope } from '../http'
import {
  deliveryPk,
  getCurrent,
  legacyPk,
  mintDeliveryId,
  mintLegacyId,
  newEvent,
  reviseAggregate,
  writeNewAggregate,
} from '../ledger'
import { NotFoundError } from '../errors'
import { callerAudit, type CallerAudit } from '../identity'
import {
  assertNotDeleted,
  rejectCreateDeleteFlag,
  requireDelivery,
  requireReceiptRecorded,
} from '../rules'
import type { CurrentRecord } from '../types'
import { movementIsHazardous, validateOperation } from '../validation'

async function recordAgainstDelivery(
  deliveryId: string,
  body: Record<string, unknown>,
  warnings: ReturnType<typeof validateOperation>['warnings'],
  eventType: 'WASTE_RECEIVED' | 'RECEIPT_UPDATED',
  statusCode: number,
  audit: CallerAudit,
): Promise<HandlerResult> {
  const previous = requireDelivery(await getCurrent(deliveryPk(deliveryId)))
  if (eventType === 'WASTE_RECEIVED') {
    assertNotDeleted(previous, 'record a receipt')
  } else {
    requireReceiptRecorded(previous)
  }

  const now = new Date().toISOString()
  const next: CurrentRecord = {
    ...previous,
    hasReceipt: true,
    payload: { ...previous.payload, receipt: body },
    revision: previous.revision + 1,
    updatedAt: now,
    apiCode: String(body.apiCode),
  }
  const domainEvent = newEvent({
    pk: previous.PK,
    eventType,
    publicId: deliveryId,
    apiCode: String(body.apiCode),
    payload: { deliveryId, ...body },
    occurredAt: String(body.dateTimeReceived ?? now),
    ...audit,
  })
  await reviseAggregate(previous, next, domainEvent)
  return { statusCode, body: validationEnvelope(warnings) }
}

export async function recordReceipt(
  event: APIGatewayProxyEvent,
  body: Record<string, unknown>,
): Promise<HandlerResult> {
  const deliveryId = pathParam(event, 'deliveryId')
  const { warnings } = validateOperation('recordReceipt', body)
  return recordAgainstDelivery(
    deliveryId,
    body,
    warnings,
    'WASTE_RECEIVED',
    201,
    await callerAudit(event),
  )
}

export async function updateReceipt(
  event: APIGatewayProxyEvent,
  body: Record<string, unknown>,
): Promise<HandlerResult> {
  const deliveryId = pathParam(event, 'deliveryId')
  const { warnings } = validateOperation('updateReceipt', body)
  return recordAgainstDelivery(
    deliveryId,
    body,
    warnings,
    'RECEIPT_UPDATED',
    200,
    await callerAudit(event),
  )
}

export async function recordReceiptWithoutDelivery(
  event: APIGatewayProxyEvent,
  body: Record<string, unknown>,
): Promise<HandlerResult> {
  const { warnings } = validateOperation('recordReceiptWithoutDelivery', body)
  const deliveryId = await mintDeliveryId()
  const now = new Date().toISOString()
  const current: CurrentRecord = {
    PK: deliveryPk(deliveryId),
    SK: 'CURRENT',
    itemType: 'CURRENT',
    entityType: 'DELIVERY',
    publicId: deliveryId,
    apiCode: String(body.apiCode),
    isDeleted: false,
    revision: 1,
    hasCollection: false,
    hasDelivery: true,
    hasReceipt: true,
    isHazardous: movementIsHazardous(body),
    collectionSequence: [],
    movementIds: [],
    payload: { ...body, movementIds: [], reasonForNoDeliveryId: body.reasonForNoDeliveryId },
    createdAt: now,
    updatedAt: now,
    gsi1pk: `ID#${deliveryId}`,
  }
  const domainEvent = newEvent({
    pk: current.PK,
    eventType: 'RECEIPT_WITHOUT_DELIVERY',
    publicId: deliveryId,
    apiCode: String(body.apiCode),
    payload: { deliveryId, ...body },
    occurredAt: String(body.dateTimeReceived ?? now),
    ...(await callerAudit(event)),
  })
  await writeNewAggregate(current, domainEvent)
  return {
    statusCode: 201,
    body: { deliveryId, ...validationEnvelope(warnings) },
  }
}

export async function createReceiptMovementLegacy(
  event: APIGatewayProxyEvent,
  body: Record<string, unknown>,
): Promise<HandlerResult> {
  const { warnings } = validateOperation('createReceiptMovementLegacy', body)
  rejectCreateDeleteFlag(body)
  const wasteTrackingId = await mintLegacyId()
  const now = new Date().toISOString()
  const current: CurrentRecord = {
    PK: legacyPk(wasteTrackingId),
    SK: 'CURRENT',
    itemType: 'CURRENT',
    entityType: 'LEGACY_RECEIPT',
    publicId: wasteTrackingId,
    apiCode: String(body.apiCode),
    isDeleted: false,
    revision: 1,
    hasCollection: false,
    hasDelivery: false,
    hasReceipt: true,
    isHazardous: movementIsHazardous(body) || body.containsHazardous === true,
    collectionSequence: [],
    movementIds: [],
    payload: body,
    createdAt: now,
    updatedAt: now,
    wasteTrackingId,
    gsi1pk: `ID#${wasteTrackingId}`,
  }
  const domainEvent = newEvent({
    pk: current.PK,
    eventType: 'LEGACY_RECEIPT_CREATED',
    publicId: wasteTrackingId,
    apiCode: String(body.apiCode),
    payload: { wasteTrackingId, ...body },
    occurredAt: String(body.dateTimeReceived ?? now),
    ...(await callerAudit(event)),
  })
  await writeNewAggregate(current, domainEvent)
  return {
    statusCode: 201,
    body: { wasteTrackingId, ...validationEnvelope(warnings) },
  }
}

export async function updateReceiptMovementLegacy(
  event: APIGatewayProxyEvent,
  body: Record<string, unknown>,
): Promise<HandlerResult> {
  // API Gateway REST allows only one {param} name under /movements/* — see ROUTES.
  // Gateway resource is {movementId}; the value is a Phase 1 wasteTrackingId.
  const wasteTrackingId = pathParam(event, 'movementId')
  const { warnings } = validateOperation('updateReceiptMovementLegacy', body)
  const previous = await getCurrent(legacyPk(wasteTrackingId))
  if (!previous || previous.entityType !== 'LEGACY_RECEIPT') {
    throw new NotFoundError('NOT_FOUND', 'Receipt movement not found')
  }
  const now = new Date().toISOString()
  const next: CurrentRecord = {
    ...previous,
    payload: body,
    revision: previous.revision + 1,
    updatedAt: now,
    apiCode: String(body.apiCode),
  }
  const domainEvent = newEvent({
    pk: previous.PK,
    eventType: 'LEGACY_RECEIPT_UPDATED',
    publicId: wasteTrackingId,
    apiCode: String(body.apiCode),
    payload: { wasteTrackingId, ...body },
    ...(await callerAudit(event)),
  })
  await reviseAggregate(previous, next, domainEvent)
  return { statusCode: 200, body: validationEnvelope(warnings) }
}
