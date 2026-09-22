#!/usr/bin/env node
/**
 * CDK app entry — five stacks matching the bounded contexts:
 *   Auth     → IAM (Cognito stand-in for Defra identity)
 *   Ledger   → Core Movements DynamoDB
 *   Events   → EventBridge + Kinesis + bronze JSON / silver Parquet lake
 *   Charging → operator ledger off the hot path
 *   Api      → per-endpoint Lambdas behind REST + JWT + API key
 *
 * `cdk synth` works without AWS credentials. `cdk bootstrap` / `cdk deploy`
 * need an account in eu-west-2.
 */

import * as cdk from 'aws-cdk-lib'
import { AuthStack } from '../lib/stacks/auth-stack'
import { LedgerStack } from '../lib/stacks/ledger-stack'
import { EventsStack } from '../lib/stacks/events-stack'
import { ChargingStack } from '../lib/stacks/charging-stack'
import { ApiStack } from '../lib/stacks/api-stack'

const app = new cdk.App()

const env: cdk.Environment = {
  // Dummy account lets `cdk synth` run before you have credentials.
  // Override with CDK_DEFAULT_ACCOUNT when deploying.
  account: process.env.CDK_DEFAULT_ACCOUNT ?? '000000000000',
  region: process.env.CDK_DEFAULT_REGION ?? 'eu-west-2',
}

const auth = new AuthStack(app, 'DwtAuth', { env })
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
})
api.addStackDependency(auth)
api.addStackDependency(ledger)

app.synth()
