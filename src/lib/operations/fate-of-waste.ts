/**
 * GET /movements/{movementId}/fate-of-waste
 *
 * The OpenAPI response schema is still a proposal. We return a practical
 * summary derived from CURRENT + the event timeline so producers can see
 * what happened without querying the append-only log themselves.
 */

import type { APIGatewayProxyEvent } from 'aws-lambda'
import { NotFoundError } from '../errors'
import type { HandlerResult } from '../http'
import { pathParam } from '../http'
import { getCurrent, listEvents, movementPk } from '../ledger'
import { requireMovement } from '../rules'

export async function getFateOfWaste(
  event: APIGatewayProxyEvent,
  _body: Record<string, unknown>,
): Promise<HandlerResult> {
  const movementId = pathParam(event, 'movementId')
  const current = await getCurrent(movementPk(movementId))
  if (!current) {
    throw new NotFoundError('MOVEMENT_NOT_FOUND', 'Movement not found')
  }
  requireMovement(current)
  const events = await listEvents(current.PK)

  return {
    statusCode: 200,
    body: {
      movementId,
      status: current.isDeleted
        ? 'DELETED'
        : current.hasReceipt
          ? 'RECEIVED'
          : current.hasDelivery
            ? 'DELIVERED'
            : current.hasCollection
              ? 'COLLECTED'
              : 'CREATED',
      isDeleted: current.isDeleted,
      isHazardous: current.isHazardous,
      hasCollection: current.hasCollection,
      hasDelivery: current.hasDelivery,
      hasReceipt: current.hasReceipt,
      createdAt: current.createdAt,
      updatedAt: current.updatedAt,
      timeline: events.map((e) => ({
        eventType: e.eventType,
        occurredAt: e.occurredAt,
        eventId: e.eventId,
      })),
    },
  }
}
