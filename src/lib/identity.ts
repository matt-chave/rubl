/**
 * Request identities on the write path.
 *
 * Software is the Cognito app client (`client_id` on the JWT). The
 * operator is the API Gateway key that DWT issued at onboarding. The
 * gateway already required both. This module reads them and maps the
 * key id from the request context to an `operatorId`. There is no
 * pairing table: any approved software plus a valid operator key may
 * submit. We still record which software called. Do not treat
 * `X-Operator-Id` as identity.
 *
 * The sandbox seeds one operator (`OP-SANDBOX-1`) and one named key.
 * Keys created by POST /operators resolve through the Operators table
 * (apiKeyId → operatorId). Movements Lambdas do not HTTP-call onboarding.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import { issue, ValidationError } from './errors'

/** Seeded workshop operator. Production issues a key per operator, not this constant. */
export const SANDBOX_OPERATOR_ID = 'OP-SANDBOX-1'

export interface CallerAudit {
  operatorId: string
  softwareApplicationId: string
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

/** Test-only override so identity lookup can be exercised without AWS. */
let testOperatorByApiKeyId: ((apiKeyId: string) => Promise<string | undefined>) | undefined

export function setOperatorLookupForTests(
  lookup: ((apiKeyId: string) => Promise<string | undefined>) | undefined,
): void {
  testOperatorByApiKeyId = lookup
}

export function callerClientId(event: APIGatewayProxyEvent): string {
  const authorizer = event.requestContext?.authorizer as
    | { claims?: Record<string, string>; client_id?: string }
    | undefined
  const id = authorizer?.claims?.client_id ?? authorizer?.claims?.sub ?? authorizer?.client_id
  if (!id) {
    throw new ValidationError([
      issue('client_id', 'NotProvided', 'Caller client id is missing from the token'),
    ])
  }
  return id
}

export function callerApiKeyId(event: APIGatewayProxyEvent): string {
  const identity = event.requestContext?.identity as { apiKeyId?: string } | undefined
  const id = identity?.apiKeyId
  if (!id) {
    throw new ValidationError([
      issue('apiKey', 'NotProvided', 'API key id is missing from the request context'),
    ])
  }
  return id
}

async function lookupOperatorIdByApiKeyId(apiKeyId: string): Promise<string | undefined> {
  if (testOperatorByApiKeyId) {
    return testOperatorByApiKeyId(apiKeyId)
  }
  const tableName = process.env.OPERATORS_TABLE
  if (!tableName) {
    return undefined
  }
  const result = await ddb.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: 'byApiKeyId',
      KeyConditionExpression: 'apiKeyId = :apiKeyId',
      ExpressionAttributeValues: { ':apiKeyId': apiKeyId },
      Limit: 1,
    }),
  )
  const item = result.Items?.[0]
  const operatorId = item?.operatorId
  return typeof operatorId === 'string' ? operatorId : undefined
}

/**
 * Resolve the waste operator from the API key. The sandbox mapping is
 * `SANDBOX_API_KEY_ID` → `SANDBOX_OPERATOR_ID`. Any other key is looked
 * up on the Operators table filled by onboarding.
 */
export async function callerOperatorId(event: APIGatewayProxyEvent): Promise<string> {
  const apiKeyId = callerApiKeyId(event)
  const mappedKeyId = process.env.SANDBOX_API_KEY_ID
  const sandboxOperatorId = process.env.SANDBOX_OPERATOR_ID ?? SANDBOX_OPERATOR_ID
  if (mappedKeyId && apiKeyId === mappedKeyId) {
    return sandboxOperatorId
  }
  const fromOnboarding = await lookupOperatorIdByApiKeyId(apiKeyId)
  if (fromOnboarding) {
    return fromOnboarding
  }
  throw new ValidationError([
    issue('apiKey', 'NotAllowed', 'API key is not mapped to a waste operator'),
  ])
}

export async function callerAudit(event: APIGatewayProxyEvent): Promise<CallerAudit> {
  return {
    operatorId: await callerOperatorId(event),
    softwareApplicationId: callerClientId(event),
  }
}
