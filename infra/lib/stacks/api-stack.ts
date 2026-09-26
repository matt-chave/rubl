/**
 * ApiStack — HTTP edge for Core Movements (CDK stack id: DwtApi).
 *
 * `cdk deploy DwtApi` creates API Gateway REST + one Lambda per OpenAPI
 * operationId. Do not click Create API in the console first. Needs DwtAuth
 * (User Pool), DwtOnboarding (Operators table and dwt-operators usage plan),
 * and DwtLedger (tables) already deployed — this stack *uses* them; it does
 * not create Cognito, the Operators table, or the usage plan.
 *
 * REST (v1), not HTTP API: usage plans and API keys exist only on REST.
 * Every route requires a Cognito JWT (approved software) *and* x-api-key
 * (the waste operator). Lambdas validate and write the ledger; they never
 * PutEvents (the stream does that in step 08).
 *
 * The single API key here is one seeded sandbox operator
 * (`dwt-operator-sandbox` → OP-SANDBOX-1). Keys from POST /operators
 * (lesson 5b) already sit on the dwt-operators usage plan created in
 * DwtOnboarding; this stack attaches that plan to the movements stage so
 * those keys can call POST /movements. Software clients stay per approved
 * product in DwtAuth (or from software-provider signup). DWT does not pair
 * operator to software at auth time; the operator hands the key to their
 * product themselves.
 *
 * Human UI (GOV.UK One Login) is out of scope. Stage name "prod" is the
 * API Gateway stage, not the AWS prod account.
 */

import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import * as cr from 'aws-cdk-lib/custom-resources'
import { Construct } from 'constructs'
import { DwtLambda } from '../constructs/dwt-lambda'

export interface ApiStackProps extends StackProps {
  userPool: cognito.IUserPool
  movementsTable: dynamodb.ITable
  historyTable: dynamodb.ITable
  sequenceTable: dynamodb.ITable
  reservationsTable: dynamodb.ITable
  operatorsTable: dynamodb.ITable
  operatorsUsagePlan: apigateway.IUsagePlan
}

interface RouteSpec {
  operationId: string
  method: string
  path: string
  description: string
}

// 1:1 with OpenAPI operationId and src/lambdas/<operationId>/index.ts
const ROUTES: RouteSpec[] = [
  { operationId: 'reserveIds', method: 'POST', path: 'id-reservations', description: 'Reserve public IDs for offline use' },
  { operationId: 'createMovement', method: 'POST', path: 'movements', description: 'Create a waste movement' },
  { operationId: 'updateMovement', method: 'PUT', path: 'movements/{movementId}', description: 'Update a waste movement' },
  { operationId: 'recordCollection', method: 'POST', path: 'movements/{movementId}/collection', description: 'Record collection' },
  { operationId: 'updateCollection', method: 'PUT', path: 'movements/{movementId}/collection', description: 'Update collection' },
  { operationId: 'getFateOfWaste', method: 'GET', path: 'movements/{movementId}/fate-of-waste', description: 'Fate of waste query' },
  { operationId: 'createReceiptMovementLegacy', method: 'POST', path: 'movements/receive', description: 'Phase 1 receipt (deprecated)' },
  // API Gateway REST allows only one {param} name under /movements/*.
  // OpenAPI still calls it wasteTrackingId; the value is a Phase 1 id.
  { operationId: 'updateReceiptMovementLegacy', method: 'PUT', path: 'movements/{movementId}/receive', description: 'Phase 1 receipt update (deprecated)' },
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
      reservations: props.reservationsTable,
    }

    this.api = new apigateway.RestApi(this, 'DwtApi', {
      restApiName: 'digital-waste-tracking',
      description: 'Digital Waste Tracking API (software JWT + operator API key)',
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

    // Check JWT locally (JWKS). Does not call Cognito per POST.
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'JwtAuthorizer', {
      cognitoUserPools: [props.userPool],
      identitySource: 'method.request.header.Authorization',
    })

    // Sandbox: one operator key for the proving path. Value lives in
    // Secrets Manager (output ApiKeySecretArn). Not the Cognito client
    // secret. Self-signup keys from DwtOnboarding already sit on the same
    // dwt-operators usage plan; Lambdas resolve apiKeyId from the Operators
    // table (or these two env vars for the sandbox key).
    const sandboxOperatorId = 'OP-SANDBOX-1'
    const apiKeySecret = new secretsmanager.Secret(this, 'SandboxOperatorApiKey', {
      description: 'API Gateway key value for the sandbox waste operator',
      generateSecretString: {
        excludePunctuation: true,
        passwordLength: 32,
      },
    })

    // Standalone ApiKey (not RestApi.addApiKey). addApiKey wires stageKeys
    // to deploymentStage; Lambdas also Ref the key id for SANDBOX_API_KEY_ID,
    // which CloudFormation rejects as a circular dependency. Association is
    // via the usage plan below and AttachOperatorsUsagePlan.
    const apiKey = new apigateway.ApiKey(this, 'SandboxOperatorKey', {
      apiKeyName: 'dwt-operator-sandbox',
      value: apiKeySecret.secretValue.unsafeUnwrap(),
    })

    // Associate the sandbox key with the onboarding usage plan. Creating
    // the association in this stack (rather than calling addApiKey on the
    // plan construct in DwtOnboarding) avoids a CloudFormation cycle.
    new apigateway.CfnUsagePlanKey(this, 'SandboxOperatorPlanKey', {
      keyId: apiKey.keyId,
      keyType: 'API_KEY',
      usagePlanId: props.operatorsUsagePlan.usagePlanId,
    })

    // Attach dwt-operators to this API stage so sandbox and signup keys
    // can call movements. updateUsagePlan lives here so Onboarding does
    // not depend on DwtApi.
    const stageValue = `${this.api.restApiId}:${this.api.deploymentStage.stageName}`
    new cr.AwsCustomResource(this, 'AttachOperatorsUsagePlan', {
      onCreate: {
        service: 'APIGateway',
        action: 'updateUsagePlan',
        parameters: {
          usagePlanId: props.operatorsUsagePlan.usagePlanId,
          patchOperations: [
            {
              op: 'add',
              path: '/apiStages',
              value: stageValue,
            },
          ],
        },
        physicalResourceId: cr.PhysicalResourceId.of(`attach-dwt-operators-${this.api.restApiId}`),
      },
      onDelete: {
        service: 'APIGateway',
        action: 'updateUsagePlan',
        parameters: {
          usagePlanId: props.operatorsUsagePlan.usagePlanId,
          patchOperations: [
            {
              op: 'remove',
              path: '/apiStages',
              value: stageValue,
            },
          ],
        },
      },
      // API Gateway IAM uses HTTP verbs (PATCH), not SDK names like
      // UpdateUsagePlan. fromSdkCalls would grant the wrong action.
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['apigateway:PATCH'],
          resources: ['arn:aws:apigateway:*::/usageplans/*'],
        }),
      ]),
      installLatestAwsSdk: false,
    })

    // Spec server URL is /dwt — keep that prefix so OpenAPI paths match.
    const dwt = this.api.root.addResource('dwt')

    // Each method requires a JWT and an API key, then invokes Lambda. The
    // handler is thin: validate, then write the ledger. authorizationScopes
    // forces the Cognito authorizer to accept an access token (client
    // credentials). Without scopes it expects an ID token and POST /movements
    // returns 401 Unauthorized for machine-to-machine JWTs.
    for (const route of ROUTES) {
      const fn = new DwtLambda(this, route.operationId, {
        operationId: route.operationId,
        description: route.description,
        tables,
        extraEnv: {
          SANDBOX_OPERATOR_ID: sandboxOperatorId,
          SANDBOX_API_KEY_ID: apiKey.keyId,
          OPERATORS_TABLE: props.operatorsTable.tableName,
          ...(route.operationId === 'reserveIds' ? { ID_RESERVATION_TTL_DAYS: '30' } : {}),
        },
      })
      props.operatorsTable.grantReadData(fn)

      const resource = dwt.resourceForPath(route.path)
      resource.addMethod(route.method, new apigateway.LambdaIntegration(fn), {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizationScopes: ['dwt/movements'],
        apiKeyRequired: true,
      })
    }

    new CfnOutput(this, 'ApiBaseUrl', { value: `${this.api.url}dwt` })
    new CfnOutput(this, 'ApiKeySecretArn', { value: apiKeySecret.secretArn })
    new CfnOutput(this, 'SandboxOperatorId', { value: sandboxOperatorId })
    new CfnOutput(this, 'SandboxApiKeyId', { value: apiKey.keyId })
    new CfnOutput(this, 'ApiId', { value: this.api.restApiId })
  }
}
