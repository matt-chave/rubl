/**
 * Charging Lambda — SQS consumer for the Billing bounded context.
 *
 * Invoked by the queue, never by API Gateway. Ingestion must not wait on
 * this function. If we throw, SQS retries then the DLQ + alarm fire.
 *
 * EventBridge wraps the envelope: body is { detail: MovementEventEnvelope }.
 * Payments are PK=OPERATOR#<apiCode>, SK=PAYMENT#<eventId> so a replay of
 * the same event is a no-op (ConditionExpression), not a second fee.
 *
 * Amount is a placeholder unit (1 event = 1 ledger line) until a statutory
 * per-event tariff is confirmed. The £26 annual fee is the same table
 * (same operator PK) with a subscription SK, written at onboarding and
 * again each year — not implemented in this slice.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import type { SQSEvent, SQSRecord } from 'aws-lambda'
import { CHARGEABLE_EVENT_TYPES, type EventType, type MovementEventEnvelope } from '../../lib/types'

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
})

interface EventBridgeSqsBody {
  detail?: MovementEventEnvelope
  'detail-type'?: string
  source?: string
}

function envelopeFromRecord(record: SQSRecord): MovementEventEnvelope | undefined {
  const parsed = JSON.parse(record.body) as EventBridgeSqsBody | MovementEventEnvelope
  if ('eventType' in parsed && 'eventId' in parsed) {
    return parsed as MovementEventEnvelope
  }
  return (parsed as EventBridgeSqsBody).detail
}

export const handler = async (event: SQSEvent): Promise<void> => {
  const table = process.env.OPERATOR_LEDGER_TABLE
  if (!table) {
    throw new Error('OPERATOR_LEDGER_TABLE must be set')
  }

  for (const record of event.Records) {
    const envelope = envelopeFromRecord(record)
    if (!envelope) {
      throw new Error(`SQS message ${record.messageId} has no event envelope`)
    }
    if (!CHARGEABLE_EVENT_TYPES.has(envelope.eventType as EventType)) {
      continue
    }

    await doc.send(
      new PutCommand({
        TableName: table,
        Item: {
          PK: `OPERATOR#${envelope.apiCode}`,
          // Per-event line. Annual £26 would be e.g. SUBSCRIPTION#<year>.
          SK: `PAYMENT#${envelope.eventId}`,
          eventId: envelope.eventId,
          eventType: envelope.eventType,
          publicId: envelope.publicId,
          apiCode: envelope.apiCode,
          occurredAt: envelope.occurredAt,
          recordedAt: new Date().toISOString(),
          // Placeholder statutory unit — replace when the tariff is confirmed.
          amount: 1,
          currency: 'GBP_UNITS',
        },
        // Idempotent: a replay of the same eventId is a no-op, not a second fee.
        ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      }),
    ).catch((err: { name?: string }) => {
      if (err.name === 'ConditionalCheckFailedException') {
        return
      }
      throw err
    })
  }
}
