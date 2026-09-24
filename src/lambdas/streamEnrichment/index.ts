/**
 * DynamoDB Streams → EventBridge Pipe enrichment.
 *
 * Pipes deliver DynamoDB-typed images (`{ S: "..." }`, `{ N: "1" }`). We
 * unmarshall and emit the canonical envelope so EventBridge (and therefore
 * Kinesis and charging) never see DynamoDB wire format.
 *
 * CURRENT and HISTORY items are filtered out at the Pipe; this function
 * still defends in depth so a misconfigured filter cannot leak snapshots.
 */

import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { AttributeValue } from '@aws-sdk/client-dynamodb'
import type { EventRecord, MovementEventEnvelope } from '../../lib/types'

interface StreamRecord {
  eventName?: string
  dynamodb?: {
    NewImage?: Record<string, AttributeValue>
  }
}

function toEnvelope(record: StreamRecord): MovementEventEnvelope | undefined {
  if (record.eventName === 'REMOVE') {
    return undefined
  }
  const image = record.dynamodb?.NewImage
  if (!image) {
    return undefined
  }
  const item = unmarshall(image) as EventRecord & { itemType?: string }
  if (item.itemType !== 'EVENT') {
    return undefined
  }
  return {
    eventType: item.eventType,
    eventId: item.eventId,
    occurredAt: item.occurredAt,
    publicId: item.publicId,
    apiCode: item.apiCode,
    // Keep the accepted API body as JSON. Bronze stores this object;
    // silver Parquet is a later Glue job, not a Firehose conversion.
    payload: item.payload ?? {},
    operatorId: item.operatorId,
    softwareApplicationId: item.softwareApplicationId,
  }
}

export const handler = async (event: StreamRecord | StreamRecord[]): Promise<MovementEventEnvelope[]> => {
  const records = Array.isArray(event) ? event : [event]
  return records.map(toEnvelope).filter((e): e is MovementEventEnvelope => e !== undefined)
}
