/**
 * POST /deliveries and PUT /deliveries/{deliveryId}
 *
 * A single POST can mix hazardous and non-hazardous Movement IDs. The
 * server splits them: non-hazardous movements share one minted deliveryId;
 * each hazardous movement becomes its own delivery whose deliveryId *is*
 * the Movement ID (OpenAPI exception — callers must not parse IDs).
 *
 * PUT cannot edit place/carrier/time — only isDeleted — because a recorded
 * delivery is immutable under policy.
 */

import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { HandlerResult } from '../http'
import { pathParam, validationEnvelope } from '../http'
import { ConflictError } from '../errors'
import {
  claimReservation,
  deliveryPk,
  getCurrent,
  mintDeliveryId,
  movementPk,
  newEvent,
  reviseAggregate,
  writeNewAggregate,
} from '../ledger'
import { callerAudit, type CallerAudit } from '../identity'
import { reservedDeliveryIdToClaim } from '../reservations'
import {
  assertCanSoftDeleteDelivery,
  assertMovementDeliverable,
  requireDelivery,
  requireMovement,
} from '../rules'
import { rejectCreateDeleteFlag } from '../rules'
import type { CurrentRecord } from '../types'
import { validateOperation } from '../validation'

interface DeliveryResult {
  deliveryId: string
  movementIds: string[]
  wasteType: 'HAZARDOUS' | 'NON_HAZARDOUS'
}

async function loadMovements(ids: string[]): Promise<Map<string, CurrentRecord>> {
  const found = new Map<string, CurrentRecord>()
  for (const id of ids) {
    const current = requireMovement(await getCurrent(movementPk(id)))
    assertMovementDeliverable(current, id)
    found.set(id, current)
  }
  return found
}

async function persistDelivery(opts: {
  deliveryId: string
  movementIds: string[]
  wasteType: 'HAZARDOUS' | 'NON_HAZARDOUS'
  body: Record<string, unknown>
  audit: CallerAudit
}): Promise<void> {
  const now = new Date().toISOString()
  const current: CurrentRecord = {
    PK: deliveryPk(opts.deliveryId),
    SK: 'CURRENT',
    itemType: 'CURRENT',
    entityType: 'DELIVERY',
    publicId: opts.deliveryId,
    apiCode: String(opts.body.apiCode),
    isDeleted: false,
    revision: 1,
    hasCollection: false,
    hasDelivery: true,
    hasReceipt: false,
    isHazardous: opts.wasteType === 'HAZARDOUS',
    collectionSequence: [],
    movementIds: opts.movementIds,
    payload: { ...opts.body, movementIds: opts.movementIds, wasteType: opts.wasteType },
    createdAt: now,
    updatedAt: now,
    gsi1pk: `ID#${opts.deliveryId}`,
  }
  const event = newEvent({
    pk: current.PK,
    eventType: 'DELIVERY_RECORDED',
    publicId: opts.deliveryId,
    apiCode: String(opts.body.apiCode),
    payload: { deliveryId: opts.deliveryId, wasteType: opts.wasteType, ...opts.body, movementIds: opts.movementIds },
    occurredAt: String(opts.body.actualDateTimeDelivered ?? now),
    ...opts.audit,
  })
  await writeNewAggregate(current, event)
}

async function markMovementsDelivered(
  movements: CurrentRecord[],
  body: Record<string, unknown>,
  audit: CallerAudit,
): Promise<void> {
  const now = new Date().toISOString()
  for (const previous of movements) {
    const next: CurrentRecord = {
      ...previous,
      hasDelivery: true,
      revision: previous.revision + 1,
      updatedAt: now,
    }
    const event = newEvent({
      pk: previous.PK,
      eventType: 'DELIVERY_RECORDED',
      publicId: previous.publicId,
      apiCode: String(body.apiCode),
      payload: { movementId: previous.publicId, namedOnDelivery: true },
      ...audit,
    })
    await reviseAggregate(previous, next, event)
  }
}

export async function recordDelivery(
  event: APIGatewayProxyEvent,
  body: Record<string, unknown>,
): Promise<HandlerResult> {
  const { warnings } = validateOperation('recordDelivery', body)
  rejectCreateDeleteFlag(body)
  const audit = await callerAudit(event)

  const movementIds = (body.movementIds as string[]).map(String)
  const loaded = await loadMovements(movementIds)
  const hazardous: string[] = []
  const nonHazardous: string[] = []
  for (const id of movementIds) {
    const rec = loaded.get(id)!
    if (rec.isHazardous) {
      hazardous.push(id)
    } else {
      nonHazardous.push(id)
    }
  }

  const deliveries: DeliveryResult[] = []

  if (nonHazardous.length > 0) {
    const reserved = reservedDeliveryIdToClaim(body.deliveryId, nonHazardous.length)
    let deliveryId: string
    if (reserved) {
      const existing = await getCurrent(deliveryPk(reserved))
      if (existing) {
        throw new ConflictError('ALREADY_EXISTS', `Delivery ${reserved} already exists`)
      }
      await claimReservation(reserved, 'DELIVERY', audit.operatorId)
      deliveryId = reserved
    } else {
      deliveryId = await mintDeliveryId()
    }
    await persistDelivery({
      deliveryId,
      movementIds: nonHazardous,
      wasteType: 'NON_HAZARDOUS',
      body,
      audit,
    })
    deliveries.push({ deliveryId, movementIds: nonHazardous, wasteType: 'NON_HAZARDOUS' })
  }

  for (const movementId of hazardous) {
    // Hazardous deliveries reuse the Movement ID rather than minting.
    await persistDelivery({
      deliveryId: movementId,
      movementIds: [movementId],
      wasteType: 'HAZARDOUS',
      body,
      audit,
    })
    deliveries.push({ deliveryId: movementId, movementIds: [movementId], wasteType: 'HAZARDOUS' })
  }

  await markMovementsDelivered([...loaded.values()], body, audit)

  return {
    statusCode: 201,
    body: { deliveries, ...validationEnvelope(warnings) },
  }
}

export async function updateDelivery(
  event: APIGatewayProxyEvent,
  body: Record<string, unknown>,
): Promise<HandlerResult> {
  const deliveryId = pathParam(event, 'deliveryId')
  const { warnings } = validateOperation('updateDelivery', body)
  const previous = requireDelivery(await getCurrent(deliveryPk(deliveryId)))

  const deleting = body.isDeleted === true
  if (deleting) {
    assertCanSoftDeleteDelivery(previous)
  }

  const now = new Date().toISOString()
  const next: CurrentRecord = {
    ...previous,
    isDeleted: deleting ? true : body.isDeleted === false ? false : previous.isDeleted,
    revision: previous.revision + 1,
    updatedAt: now,
    apiCode: String(body.apiCode),
  }

  const domainEvent = newEvent({
    pk: previous.PK,
    eventType: deleting ? 'DELIVERY_DELETED' : 'DELIVERY_RESTORED',
    publicId: deliveryId,
    apiCode: String(body.apiCode),
    payload: { deliveryId, isDeleted: next.isDeleted },
    ...(await callerAudit(event)),
  })
  await reviseAggregate(previous, next, domainEvent)

  return { statusCode: 200, body: validationEnvelope(warnings) }
}
