/**
 * POST /software-providers — register approved software.
 *
 * Creates a Cognito app client on the existing dwt-vendor-m2m pool with
 * client credentials and scope dwt/movements. Stores the provider profile
 * and client id. Returns clientId, clientSecret, and tokenUrl once.
 */

import {
  CognitoIdentityProviderClient,
  CreateUserPoolClientCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyEvent } from 'aws-lambda'
import type { HandlerResult } from '../http'
import { newSoftwareProviderId, requireContactEmail, requireTrimmedString } from '../onboarding'

const cognito = new CognitoIdentityProviderClient({})
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

export async function createSoftwareProvider(
  _event: APIGatewayProxyEvent,
  body: Record<string, unknown>,
): Promise<HandlerResult> {
  const productName = requireTrimmedString(body, 'productName', 'product name')
  const contactEmail = requireContactEmail(body)

  const userPoolId = process.env.USER_POOL_ID
  const tokenUrl = process.env.TOKEN_URL
  const tableName = process.env.SOFTWARE_PROVIDERS_TABLE
  if (!userPoolId || !tokenUrl || !tableName) {
    throw new Error('Software provider signup is not configured')
  }

  const softwareProviderId = newSoftwareProviderId()
  const clientName = `dwt-provider-${softwareProviderId.toLowerCase()}`

  const created = await cognito.send(
    new CreateUserPoolClientCommand({
      UserPoolId: userPoolId,
      ClientName: clientName,
      GenerateSecret: true,
      AllowedOAuthFlows: ['client_credentials'],
      AllowedOAuthFlowsUserPoolClient: true,
      AllowedOAuthScopes: ['dwt/movements'],
      SupportedIdentityProviders: ['COGNITO'],
    }),
  )

  const clientId = created.UserPoolClient?.ClientId
  const clientSecret = created.UserPoolClient?.ClientSecret
  if (!clientId || !clientSecret) {
    throw new Error('Cognito did not return a client id and secret')
  }

  const now = new Date().toISOString()
  await ddb.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: `SOFTWARE#${softwareProviderId}`,
        softwareProviderId,
        productName,
        contactEmail,
        clientId,
        clientName,
        createdAt: now,
      },
      ConditionExpression: 'attribute_not_exists(PK)',
    }),
  )

  return {
    statusCode: 201,
    body: {
      softwareProviderId,
      productName,
      contactEmail,
      clientId,
      clientSecret,
      tokenUrl,
      scope: process.env.OAUTH_SCOPE ?? 'dwt/movements',
    },
  }
}
