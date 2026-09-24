/**
 * ChargingStack — Billing bounded context, off the hot path (CDK id: DwtCharging).
 *
 * `cdk deploy DwtCharging` creates the queue, worker, operator ledger, and
 * a rule on the *existing* bus from DwtEvents. Do not click Create queue
 * or Create table in the console first. This stack does not create the
 * event bus, the movements table, or the API.
 *
 * Path: EventBridge (chargeable types only) → SQS → Lambda → operator ledger.
 * The API Lambda never calls this. If this stack is down, vendors still
 * get 201 — that is the isolation rule.
 *
 * The DLQ + CloudWatch alarm are how operators learn a payment line was
 * not recorded.
 *
 * Same operator-ledger *schema* as the £26 annual fee (PK=OPERATOR#…).
 * That line is a different SK (subscription period, not PAYMENT#eventId)
 * and a different trigger: operator onboarding, then once a year. This
 * slice only writes per-event placeholder units. Onboarding / GOV.UK Pay
 * come later — they should PutItem here, not invent a second ledger.
 */

import { Duration, RemovalPolicy, Stack, StackProps, CfnOutput } from 'aws-cdk-lib'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import { Construct } from 'constructs'
import { DwtLambda } from '../constructs/dwt-lambda'

export interface ChargingStackProps extends StackProps {
  /** Custom bus from DwtEvents — we subscribe; we do not own it. */
  eventBus: events.IEventBus
}

// Statutory-ish lifecycle writes only. Updates, deletes, restores, and
// collection, delivery, or receipt revisions are not billed again. Keep
// this list in sync with CHARGEABLE_EVENT_TYPES in src/lib/types.ts.
const CHARGEABLE = [
  'MOVEMENT_CREATED',
  'WASTE_COLLECTED',
  'DELIVERY_RECORDED',
  'WASTE_RECEIVED',
  'RECEIPT_WITHOUT_DELIVERY',
  'LEGACY_RECEIPT_CREATED',
]

export class ChargingStack extends Stack {
  public readonly operatorLedger: dynamodb.Table

  constructor(scope: Construct, id: string, props: ChargingStackProps) {
    super(scope, id, props)

    // Billing language (operator, payment line) — not the movements table.
    // PK/SK are String. Prefixes OPERATOR# / PAYMENT# are a convention in
    // src/lambdas/charging. Sandbox: destroy with the stack.
    this.operatorLedger = new dynamodb.Table(this, 'OperatorLedger', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY,
    })

    // After five failed receives, the message leaves the main queue so
    // poison payloads cannot block charging forever.
    const dlq = new sqs.Queue(this, 'Dlq', {
      retentionPeriod: Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    })

    // Visibility 60s > Lambda timeout (30s) so a running worker is not
    // handed the same message twice. Retention 4 days is the retry window.
    const queue = new sqs.Queue(this, 'Queue', {
      visibilityTimeout: Duration.seconds(60),
      retentionPeriod: Duration.days(4),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: { queue: dlq, maxReceiveCount: 5 },
    })

    // Same bus and envelope as the lake. Only chargeable eventType values
    // match — lake still gets every WasteMovementEvent.
    new events.Rule(this, 'ChargeableToSqs', {
      eventBus: props.eventBus,
      description: 'Chargeable movement events to operator ledger via SQS',
      eventPattern: {
        source: ['dwt.movements'],
        detailType: ['WasteMovementEvent'],
        detail: { eventType: CHARGEABLE },
      },
      targets: [new targets.SqsQueue(queue)],
    })

    const chargingFn = new DwtLambda(this, 'ChargingFn', {
      operationId: 'charging',
      description: 'Record a payment line on the waste operator ledger',
      extraEnv: { OPERATOR_LEDGER_TABLE: this.operatorLedger.tableName },
      timeout: Duration.seconds(30),
    })
    this.operatorLedger.grantWriteData(chargingFn)
    chargingFn.addEventSource(
      new lambdaEventSources.SqsEventSource(queue, { batchSize: 10 }),
    )

    // Alarm when anything is visible on the DLQ. That is the pager, not
    // a failed vendor POST.
    new cloudwatch.Alarm(this, 'ChargingDlqAlarm', {
      metric: dlq.metricApproximateNumberOfMessagesVisible(),
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: 'A charging event could not be recorded after retries',
    })

    new CfnOutput(this, 'OperatorLedgerTableName', { value: this.operatorLedger.tableName })
    new CfnOutput(this, 'ChargingQueueUrl', { value: queue.queueUrl })
    new CfnOutput(this, 'ChargingDlqUrl', { value: dlq.queueUrl })
  }
}
