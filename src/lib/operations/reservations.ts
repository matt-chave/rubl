/**
 * POST /id-reservations — mint and reserve public IDs for offline use.
 *
 * Reuses nextSequence and mintPublicId. Does not write EVENT or CURRENT.
 * Unused IDs belong to the operator on the API key. The software client
 * is recorded on the row and is not the owner.
 */

import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { HandlerResult } from '../http'
import { callerAudit } from '../identity'
import { countInCirculation, mintDeliveryId, mintMovementId, putReservation } from '../ledger'
import {
  allocateCirculation,
  ownerReservedGsiPk,
  parseReserveCounts,
  reservationPk,
  reservationWindow,
} from '../reservations'

export async function reserveIds(
  event: APIGatewayProxyEvent,
  body: Record<string, unknown>,
): Promise<HandlerResult> {
  const requested = parseReserveCounts(body)
  const { operatorId, softwareApplicationId } = await callerAudit(event)
  const inCirculation = await countInCirculation(operatorId)
  const { movementCount, deliveryCount } = allocateCirculation(requested, inCirculation)
  const { expiresAt, ttl } = reservationWindow()
  const reservedAt = new Date().toISOString()
  const gsi1pk = ownerReservedGsiPk(operatorId)

  const movementIds: string[] = []
  for (let i = 0; i < movementCount; i += 1) {
    const publicId = await mintMovementId()
    await putReservation({
      PK: reservationPk(publicId),
      kind: 'MOVEMENT',
      status: 'RESERVED',
      ownerOperatorId: operatorId,
      reservedByClientId: softwareApplicationId,
      expiresAt,
      reservedAt,
      ttl,
      gsi1pk,
      gsi1sk: publicId,
    })
    movementIds.push(publicId)
  }

  const deliveryIds: string[] = []
  for (let i = 0; i < deliveryCount; i += 1) {
    const publicId = await mintDeliveryId()
    await putReservation({
      PK: reservationPk(publicId),
      kind: 'DELIVERY',
      status: 'RESERVED',
      ownerOperatorId: operatorId,
      reservedByClientId: softwareApplicationId,
      expiresAt,
      reservedAt,
      ttl,
      gsi1pk,
      gsi1sk: publicId,
    })
    deliveryIds.push(publicId)
  }

  return {
    statusCode: 201,
    body: {
      movementIds,
      deliveryIds,
      expiresAt,
      inCirculation: inCirculation + movementIds.length + deliveryIds.length,
    },
  }
}
