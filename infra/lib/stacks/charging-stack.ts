/**
 * ChargingStack — Billing bounded context, off the hot path.
 *
 * EventBridge rule (chargeable types only) → SQS → Lambda → operator ledger.
 * If this stack is down, vendors can still POST movements. The DLQ alarm is
 * how operators learn a payment was not recorded.
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
  eventBus: events.IEventBus
}

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

    this.operatorLedger = new dynamodb.Table(this, 'OperatorLedger', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const dlq = new sqs.Queue(this, 'Dlq', {
      retentionPeriod: Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    })

    const queue = new sqs.Queue(this, 'Queue', {
      visibilityTimeout: Duration.seconds(60),
      retentionPeriod: Duration.days(4),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: { queue: dlq, maxReceiveCount: 5 },
    })

    new events.Rule(this, 'ChargeableToSqs', {
      eventBus: props.eventBus,
      description: 'Chargeable movement events → operator ledger via SQS',
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
