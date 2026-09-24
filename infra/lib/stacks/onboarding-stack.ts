/**
 * OnboardingStack — software-provider and waste-operator signup
 * (CDK stack id: DwtOnboarding).
 *
 * The onboarding team owns this front door. It is not the movements API.
 * Software providers receive a Cognito app client on the existing
 * dwt-vendor-m2m pool. Waste operators receive a profile on the Operators
 * table and an API Gateway key on the dwt-operators usage plan. Secrets
 * and key values are returned once; they are not stored.
 *
 * Deploy after DwtAuth. The usage plan is created here without an API
 * stage. DwtApi (lesson 07) attaches the plan to the movements stage so
 * keys issued in lesson 5b can call POST /movements.
 */

import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'
import { DwtLambda } from '../constructs/dwt-lambda'

export interface OnboardingStackProps extends StackProps {
  userPool: cognito.IUserPool
  /** Hosted Cognito domain prefix host, e.g. dwt123.auth.eu-west-2.amazoncognito.com */
  tokenUrl: string
}

export class OnboardingStack extends Stack {
  public readonly operatorsTable: dynamodb.Table
  public readonly softwareProvidersTable: dynamodb.Table
  public readonly usagePlan: apigateway.UsagePlan
  public readonly api: apigateway.RestApi

  constructor(scope: Construct, id: string, props: OnboardingStackProps) {
    super(scope, id, props)

    // Profiles for waste operators who self-sign up. Movements Lambdas
    // read apiKeyId → operatorId from this table; they do not call this
    // API on every POST.
    this.operatorsTable = new dynamodb.Table(this, 'Operators', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
    })
    this.operatorsTable.addGlobalSecondaryIndex({
      indexName: 'byApiKeyId',
      partitionKey: { name: 'apiKeyId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // Software provider registrations. We store clientId, not the secret.
    this.softwareProvidersTable = new dynamodb.Table(this, 'SoftwareProviders', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    // Shared operator usage plan. Keys created at signup attach here.
    // The movements API stage is associated later in DwtApi.
    this.usagePlan = new apigateway.UsagePlan(this, 'OperatorPlan', {
      name: 'dwt-operators',
      throttle: { rateLimit: 50, burstLimit: 100 },
      quota: { limit: 100000, period: apigateway.Period.DAY },
    })

    this.api = new apigateway.RestApi(this, 'OnboardingApi', {
      restApiName: 'digital-waste-tracking-onboarding',
      description: 'Software provider and waste operator self sign-up (registration front door)',
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
        allowHeaders: ['Content-Type'],
        allowMethods: ['POST', 'OPTIONS'],
      },
    })

    const createSoftwareProvider = new DwtLambda(this, 'createSoftwareProvider', {
      operationId: 'createSoftwareProvider',
      description: 'Register a software provider and create a Cognito app client',
      extraEnv: {
        USER_POOL_ID: props.userPool.userPoolId,
        TOKEN_URL: props.tokenUrl,
        SOFTWARE_PROVIDERS_TABLE: this.softwareProvidersTable.tableName,
        OAUTH_SCOPE: 'dwt/movements',
      },
    })
    this.softwareProvidersTable.grantReadWriteData(createSoftwareProvider)
    createSoftwareProvider.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cognito-idp:CreateUserPoolClient'],
        resources: [props.userPool.userPoolArn],
      }),
    )

    const createOperator = new DwtLambda(this, 'createOperator', {
      operationId: 'createOperator',
      description: 'Register a waste operator and issue an API Gateway key',
      extraEnv: {
        OPERATORS_TABLE: this.operatorsTable.tableName,
        USAGE_PLAN_ID: this.usagePlan.usagePlanId,
      },
    })
    this.operatorsTable.grantReadWriteData(createOperator)
    createOperator.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['apigateway:POST', 'apigateway:GET'],
        resources: [
          `arn:aws:apigateway:${this.region}::/apikeys`,
          `arn:aws:apigateway:${this.region}::/apikeys/*`,
          `arn:aws:apigateway:${this.region}::/usageplans/${this.usagePlan.usagePlanId}`,
          `arn:aws:apigateway:${this.region}::/usageplans/${this.usagePlan.usagePlanId}/*`,
        ],
      }),
    )

    const softwareProviders = this.api.root.addResource('software-providers')
    softwareProviders.addMethod('POST', new apigateway.LambdaIntegration(createSoftwareProvider), {
      apiKeyRequired: false,
      authorizationType: apigateway.AuthorizationType.NONE,
    })

    const operators = this.api.root.addResource('operators')
    operators.addMethod('POST', new apigateway.LambdaIntegration(createOperator), {
      apiKeyRequired: false,
      authorizationType: apigateway.AuthorizationType.NONE,
    })

    new CfnOutput(this, 'OnboardingApiBaseUrl', { value: this.api.url.replace(/\/$/, '') })
    new CfnOutput(this, 'OperatorsTableName', { value: this.operatorsTable.tableName })
    new CfnOutput(this, 'SoftwareProvidersTableName', { value: this.softwareProvidersTable.tableName })
    new CfnOutput(this, 'OperatorsUsagePlanId', { value: this.usagePlan.usagePlanId })
  }
}
