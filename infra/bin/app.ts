#!/usr/bin/env node
/**
 * CDK app entry. Stacks match the bounded contexts: Auth is IAM
 * (Cognito standing in for Defra identity), Onboarding issues software
 * clients and operator API keys, Ledger is Core Movements DynamoDB,
 * Events is the EventBridge / Kinesis / bronze-JSON / silver-Parquet
 * lake, Charging is the operator ledger off the hot path, and Api is the
 * per-endpoint Lambdas behind REST, a software JWT, and an operator API key.
 *
 * `cdk synth` works without AWS credentials. `cdk bootstrap` and `cdk deploy`
 * need an account in eu-west-2.
 */

import * as cdk from 'aws-cdk-lib'
import { env as nodeEnv } from 'node:process'
import { AuthStack } from '../lib/stacks/auth-stack'
import { OnboardingStack } from '../lib/stacks/onboarding-stack'
import { LedgerStack } from '../lib/stacks/ledger-stack'
import { EventsStack } from '../lib/stacks/events-stack'
import { ChargingStack } from '../lib/stacks/charging-stack'
import { ApiStack } from '../lib/stacks/api-stack'

const app = new cdk.App()

const env: cdk.Environment = {
  // Dummy account lets `cdk synth` run before you have credentials.
  // Override with CDK_DEFAULT_ACCOUNT when deploying.
  account: nodeEnv.CDK_DEFAULT_ACCOUNT ?? '000000000000',
  region: nodeEnv.CDK_DEFAULT_REGION ?? 'eu-west-2',
}

const auth = new AuthStack(app, 'DwtAuth', { env })

const onboarding = new OnboardingStack(app, 'DwtOnboarding', {
  env,
  userPool: auth.userPool,
  tokenUrl: auth.tokenUrl,
})
onboarding.addStackDependency(auth)

const ledger = new LedgerStack(app, 'DwtLedger', { env })
const events = new EventsStack(app, 'DwtEvents', {
  env,
  movementsTable: ledger.movementsTable,
})
events.addStackDependency(ledger)

const charging = new ChargingStack(app, 'DwtCharging', {
  env,
  eventBus: events.eventBus,
})
charging.addStackDependency(events)

const api = new ApiStack(app, 'DwtApi', {
  env,
  userPool: auth.userPool,
  movementsTable: ledger.movementsTable,
  historyTable: ledger.historyTable,
  sequenceTable: ledger.sequenceTable,
  reservationsTable: ledger.reservationsTable,
  operatorsTable: onboarding.operatorsTable,
  operatorsUsagePlan: onboarding.usagePlan,
})
api.addStackDependency(auth)
api.addStackDependency(ledger)
api.addStackDependency(onboarding)

app.synth()
