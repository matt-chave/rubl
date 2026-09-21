/**
 * ApiStack — REST API (v1) with Cognito JWT + API key on every route.
 *
 * REST rather than HTTP API because usage plans / API keys only exist on
 * REST. Each OpenAPI operationId is its own Lambda so we can scale and
 * deploy one endpoint without the others.
 */

import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import { Construct } from 'constructs'
import { DwtLambda } from '../constructs/dwt-lambda'

export interface ApiStackProps extends StackProps {
  userPool: cognito.IUserPool
  movementsTable: dynamodb.ITable
  historyTable: dynamodb.ITable
  sequenceTable: dynamodb.ITable
}

interface RouteSpec {
  operationId: string
  method: string
  path: string
  description: string
}

const ROUTES: RouteSpec[] = [
  { operationId: 'createMovement', method: 'POST', path: 'movements', description: 'Create a waste movement' },
  { operationId: 'updateMovement', method: 'PUT', path: 'movements/{movementId}', description: 'Update a waste movement' },
  { operationId: 'recordCollection', method: 'POST', path: 'movements/{movementId}/collection', description: 'Record collection' },
  { operationId: 'updateCollection', method: 'PUT', path: 'movements/{movementId}/collection', description: 'Update collection' },
  { operationId: 'getFateOfWaste', method: 'GET', path: 'movements/{movementId}/fate-of-waste', description: 'Fate of waste query' },
  { operationId: 'createReceiptMovementLegacy', method: 'POST', path: 'movements/receive', description: 'Phase 1 receipt (deprecated)' },
  { operationId: 'updateReceiptMovementLegacy', method: 'PUT', path: 'movements/{wasteTrackingId}/receive', description: 'Phase 1 receipt update (deprecated)' },
  { operationId: 'recordDelivery', method: 'POST', path: 'deliveries', description: 'Record a delivery' },
  { operationId: 'updateDelivery', method: 'PUT', path: 'deliveries/{deliveryId}', description: 'Soft-delete or restore a delivery' },
  { operationId: 'recordReceipt', method: 'POST', path: 'deliveries/{deliveryId}/receipt', description: 'Record receipt against a delivery' },
  { operationId: 'updateReceipt', method: 'PUT', path: 'deliveries/{deliveryId}/receipt', description: 'Update receipt against a delivery' },
  { operationId: 'recordReceiptWithoutDelivery', method: 'POST', path: 'receipts', description: 'Receipt with no prior delivery' },
  { operationId: 'listEwcCodes', method: 'GET', path: 'reference-data/ewc-codes', description: 'List EWC codes' },
  { operationId: 'listHazardousPropertyCodes', method: 'GET', path: 'reference-data/hazardous-property-codes', description: 'List hazardous property codes' },
  { operationId: 'listDisposalOrRecoveryCodes', method: 'GET', path: 'reference-data/disposal-or-recovery-codes', description: 'List disposal or recovery codes' },
  { operationId: 'listContainerTypes', method: 'GET', path: 'reference-data/container-types', description: 'List container types' },
  { operationId: 'listPopNames', method: 'GET', path: 'reference-data/pop-names', description: 'List POP names' },
]

export class ApiStack extends Stack {
  public readonly api: apigateway.RestApi

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props)

    const tables = {
      movements: props.movementsTable,
      history: props.historyTable,
      sequences: props.sequenceTable,
    }

    this.api = new apigateway.RestApi(this, 'DwtApi', {
      restApiName: 'digital-waste-tracking',
      description: 'Digital Waste Tracking API (OAuth2 + API key)',
      cloudWatchRole: true,
      deployOptions: {
        stageName: 'prod',
        tracingEnabled: true,
        metricsEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: false,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
        allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
      },
    })

    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'JwtAuthorizer', {
      cognitoUserPools: [props.userPool],
      identitySource: 'method.request.header.Authorization',
    })

    const apiKeySecret = new secretsmanager.Secret(this, 'VendorApiKey', {
      description: 'API Gateway key value for vendor software',
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 32,
      },
    })

    const apiKey = this.api.addApiKey('VendorKey', {
      apiKeyName: 'dwt-vendor-key',
      value: apiKeySecret.secretValue.unsafeUnwrap(),
    })

    const plan = this.api.addUsagePlan('VendorPlan', {
      name: 'dwt-vendor',
      throttle: { rateLimit: 50, burstLimit: 100 },
      quota: { limit: 100000, period: apigateway.Period.DAY },
    })
    plan.addApiKey(apiKey)
    plan.addApiStage({ stage: this.api.deploymentStage })

    // Spec server URL is /dwt — keep that prefix so vendor paths match OpenAPI.
    const dwt = this.api.root.addResource('dwt')

    for (const route of ROUTES) {
      const fn = new DwtLambda(this, route.operationId, {
        operationId: route.operationId,
        description: route.description,
        tables,
      })

      const resource = dwt.resourceForPath(route.path)
      resource.addMethod(route.method, new apigateway.LambdaIntegration(fn), {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        apiKeyRequired: true,
      })
    }

    new CfnOutput(this, 'ApiBaseUrl', { value: `${this.api.url}dwt` })
    new CfnOutput(this, 'ApiKeySecretArn', { value: apiKeySecret.secretArn })
    new CfnOutput(this, 'ApiId', { value: this.api.restApiId })
  }
}
