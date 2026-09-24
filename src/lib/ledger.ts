/**
 * DynamoDB access for the Core Movements Ledger.
 *
 * Two write styles, deliberately:
 *   - EVENT items are append-only PutItem (the legal audit trail).
 *   - CURRENT items are PutItem of the whole document (fast GetItem for
 *     business-rule checks). Before we overwrite CURRENT on a PUT, we copy
 *     it to the history table — that is the "snapshot then revise" rule in
 *     the OpenAPI description.
 *
 * We never UpdateItem on the event store. DynamoDB *can* update in place;
 * we refuse to, so history cannot be silently overwritten.
 *
 * EventBridge is NOT called from here. DynamoDB Streams + an EventBridge
 * Pipe publish the EVENT item after it lands. That avoids a dual-write
 * where DynamoDB succeeds and the bus fails.
 */

import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { ConflictError } from './errors'
import { mintPublicId, mintWasteTrackingId } from './ids'
import { assertClaimable, ownerReservedGsiPk, reservationPk } from './reservations'
import type {
  CurrentRecord,
  EventRecord,
  EventType,
  ItemType,
  ReservationItem,
  ReservationKind,
} from './types'

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
})

export function tables() {
  const movements = process.env.MOVEMENTS_TABLE
  const history = process.env.HISTORY_TABLE
  const sequences = process.env.SEQUENCE_TABLE
  if (!movements || !history || !sequences) {
    throw new Error('MOVEMENTS_TABLE, HISTORY_TABLE and SEQUENCE_TABLE must be set')
  }
  return { movements, history, sequences }
}

export function reservationsTableName(): string {
  const name = process.env.RESERVATIONS_TABLE
  if (!name) {
    throw new Error('RESERVATIONS_TABLE must be set')
  }
  return name
}

export function movementPk(movementId: string): string {
  return `MOVEMENT#${movementId}`
}

export function deliveryPk(deliveryId: string): string {
  return `DELIVERY#${deliveryId}`
}

export function legacyPk(wasteTrackingId: string): string {
  return `LEGACY#${wasteTrackingId}`
}

export async function nextSequence(name: 'MOVEMENT' | 'DELIVERY' | 'LEGACY'): Promise<number> {
  const { sequences } = tables()
  const result = await client.send(
    new UpdateCommand({
      TableName: sequences,
      Key: { PK: `SEQUENCE#${name}` },
      UpdateExpression: 'ADD #n :one',
      ExpressionAttributeNames: { '#n': 'n' },
      ExpressionAttributeValues: { ':one': 1 },
      ReturnValues: 'UPDATED_NEW',
    }),
  )
  return Number(result.Attributes?.n ?? 1)
}

export async function mintMovementId(): Promise<string> {
  return mintPublicId(await nextSequence('MOVEMENT'))
}

export async function mintDeliveryId(): Promise<string> {
  return mintPublicId(await nextSequence('DELIVERY'))
}

export async function mintLegacyId(): Promise<string> {
  return mintWasteTrackingId(await nextSequence('LEGACY'))
}

export async function putReservation(item: ReservationItem): Promise<void> {
  await client.send(
    new PutCommand({
      TableName: reservationsTableName(),
      Item: item,
      ConditionExpression: 'attribute_not_exists(PK)',
    }),
  )
}

export async function countInCirculation(ownerOperatorId: string, now: Date = new Date()): Promise<number> {
  const nowIso = now.toISOString()
  let exclusiveStartKey: Record<string, unknown> | undefined
  let count = 0
  do {
    const result = await client.send(
      new QueryCommand({
        TableName: reservationsTableName(),
        IndexName: 'gsi1',
        KeyConditionExpression: 'gsi1pk = :pk',
        FilterExpression: 'expiresAt > :now',
        ExpressionAttributeValues: {
          ':pk': ownerReservedGsiPk(ownerOperatorId),
          ':now': nowIso,
        },
        ExclusiveStartKey: exclusiveStartKey,
      }),
    )
    count += result.Items?.length ?? 0
    exclusiveStartKey = result.LastEvaluatedKey
  } while (exclusiveStartKey)
  return count
}

export async function getReservation(publicId: string): Promise<ReservationItem | undefined> {
  const result = await client.send(
    new GetCommand({
      TableName: reservationsTableName(),
      Key: { PK: reservationPk(publicId) },
    }),
  )
  return result.Item as ReservationItem | undefined
}

export async function claimReservation(
  publicId: string,
  kind: ReservationKind,
  ownerOperatorId: string,
  now: Date = new Date(),
): Promise<void> {
  const item = await getReservation(publicId)
  assertClaimable(item, { kind, ownerOperatorId, now })
  try {
    await client.send(
      new UpdateCommand({
        TableName: reservationsTableName(),
        Key: { PK: reservationPk(publicId) },
        UpdateExpression: 'SET #s = :consumed REMOVE #ttl, gsi1pk, gsi1sk',
        ConditionExpression: '#s = :reserved AND ownerOperatorId = :owner AND kind = :kind AND expiresAt > :now',
        ExpressionAttributeNames: { '#s': 'status', '#ttl': 'ttl' },
        ExpressionAttributeValues: {
          ':consumed': 'CONSUMED',
          ':reserved': 'RESERVED',
          ':owner': ownerOperatorId,
          ':kind': kind,
          ':now': now.toISOString(),
        },
      }),
    )
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      assertClaimable(undefined, { kind, ownerOperatorId, now })
    }
    throw err
  }
}

export async function getCurrent(pk: string): Promise<CurrentRecord | undefined> {
  const { movements } = tables()
  const result = await client.send(
    new GetCommand({
      TableName: movements,
      Key: { PK: pk, SK: 'CURRENT' },
    }),
  )
  return result.Item as CurrentRecord | undefined
}

export async function putCurrent(record: CurrentRecord): Promise<void> {
  const { movements } = tables()
  await client.send(
    new PutCommand({
      TableName: movements,
      Item: record,
    }),
  )
}

export async function appendEvent(record: EventRecord): Promise<void> {
  const { movements } = tables()
  await client.send(
    new PutCommand({
      TableName: movements,
      Item: record,
      // EVENT items are immutable. A colliding eventId is a bug, not an upsert.
      ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
    }),
  )
}

export async function snapshotToHistory(current: CurrentRecord): Promise<void> {
  const { history } = tables()
  await client.send(
    new PutCommand({
      TableName: history,
      Item: {
        ...current,
        SK: `HISTORY#${String(current.revision).padStart(8, '0')}`,
        itemType: 'HISTORY' as ItemType,
        snapshottedAt: new Date().toISOString(),
      },
    }),
  )
}

export function newEvent(input: {
  pk: string
  eventType: EventType
  publicId: string
  apiCode: string
  payload: Record<string, unknown>
  occurredAt?: string
  operatorId?: string
  softwareApplicationId?: string
}): EventRecord {
  const eventId = crypto.randomUUID()
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  return {
    PK: input.pk,
    SK: `EVENT#${occurredAt}#${input.eventType}#${eventId}`,
    itemType: 'EVENT',
    eventType: input.eventType,
    eventId,
    occurredAt,
    publicId: input.publicId,
    apiCode: input.apiCode,
    payload: input.payload,
    gsi1pk: `ID#${input.publicId}`,
    operatorId: input.operatorId,
    softwareApplicationId: input.softwareApplicationId,
  }
}

export async function writeNewAggregate(current: CurrentRecord, event: EventRecord): Promise<void> {
  await appendEvent(event)
  try {
    await client.send(
      new PutCommand({
        TableName: tables().movements,
        Item: current,
        ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      }),
    )
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      throw new ConflictError('ALREADY_EXISTS', `Record ${current.publicId} already exists`)
    }
    throw err
  }
}

export async function reviseAggregate(
  previous: CurrentRecord,
  next: CurrentRecord,
  event: EventRecord,
): Promise<void> {
  await snapshotToHistory(previous)
  await appendEvent(event)
  await putCurrent(next)
}

export async function listEvents(pk: string): Promise<EventRecord[]> {
  const { movements } = tables()
  const result = await client.send(
    new QueryCommand({
      TableName: movements,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': pk,
        ':sk': 'EVENT#',
      },
    }),
  )
  return (result.Items ?? []) as EventRecord[]
}
