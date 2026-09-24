/**
 * POST /operators — register a waste operator.
 *
 * Persists organisation name, address, and contact email on the Operators
 * table, creates an API Gateway key, and attaches it to the dwt-operators
 * usage plan. Returns the key value once with operatorId. Does not store
 * the key value.
 */

import {
  APIGatewayClient,
  CreateApiKeyCommand,
  CreateUsagePlanKeyCommand,
} from '@aws-sdk/client-api-gateway'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { HandlerResult } from '../http'
import { newOperatorId, requireContactEmail, requireTrimmedString } from '../onboarding'

const apigw = new APIGatewayClient({})
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

export async function createOperator(
  _event: APIGatewayProxyEvent,
  body: Record<string, unknown>,
): Promise<HandlerResult> {
  const organisationName = requireTrimmedString(body, 'organisationName', 'organisation name')
  const address = requireTrimmedString(body, 'address', 'organisation address')
  const contactEmail = requireContactEmail(body)

  const tableName = process.env.OPERATORS_TABLE
  const usagePlanId = process.env.USAGE_PLAN_ID
  if (!tableName || !usagePlanId) {
    throw new Error('Operator signup is not configured')
  }

  const operatorId = newOperatorId()
  const keyName = `dwt-operator-${operatorId.toLowerCase()}`

  const created = await apigw.send(
    new CreateApiKeyCommand({
      name: keyName,
      description: `Waste operator ${organisationName}`,
      enabled: true,
      generateDistinctId: true,
    }),
  )

  const apiKeyId = created.id
  const apiKeyValue = created.value
  if (!apiKeyId || !apiKeyValue) {
    throw new Error('API Gateway did not return an API key id and value')
  }

  await apigw.send(
    new CreateUsagePlanKeyCommand({
      usagePlanId,
      keyId: apiKeyId,
      keyType: 'API_KEY',
    }),
  )

  const now = new Date().toISOString()
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: `OPERATOR#${operatorId}`,
        operatorId,
        organisationName,
        address,
        contactEmail,
        apiKeyId,
        apiKeyName: keyName,
        createdAt: now,
      },
      ConditionExpression: 'attribute_not_exists(PK)',
    }),
  )

  return {
    statusCode: 201,
    body: {
      operatorId,
      organisationName,
      address,
      contactEmail,
      apiKey: apiKeyValue,
      apiKeyId,
    },
  }
}
