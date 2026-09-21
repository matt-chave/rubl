/**
 * EventsStack — fan-out after a durable ledger write.
 *
 * DynamoDB Streams → EventBridge Pipe (with enrichment) → custom bus.
 * The bus then fans out:
 *   1. Kinesis Data Stream → Firehose (Parquet) → S3 lake
 *   2. Charging SQS (wired in ChargingStack)
 *
 * Why not PutEvents from the API Lambda: a dual-write can succeed in
 * DynamoDB and fail on the bus. Streams make the stored EVENT the source
 * of truth.
 */

import { Duration, RemovalPolicy, Stack, StackProps, CfnOutput } from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as kinesis from 'aws-cdk-lib/aws-kinesis'
import * as pipes from 'aws-cdk-lib/aws-pipes'
import * as s3 from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'
import { DwtLambda } from '../constructs/dwt-lambda'
import { ParquetFirehose } from '../constructs/parquet-firehose'

export interface EventsStackProps extends StackProps {
  movementsTable: dynamodb.Table
}

export class EventsStack extends Stack {
  public readonly eventBus: events.EventBus
  public readonly lakeBucket: s3.Bucket
  public readonly movementStream: kinesis.Stream

  constructor(scope: Construct, id: string, props: EventsStackProps) {
    super(scope, id, props)

    this.eventBus = new events.EventBus(this, 'Bus', {
      eventBusName: 'dwt-waste-movements',
    })

    const enrichment = new DwtLambda(this, 'StreamEnrichment', {
      operationId: 'streamEnrichment',
      description: 'Unmarshall DynamoDB Streams images into the canonical event envelope',
      timeout: Duration.seconds(30),
    })

    const pipeRole = new iam.Role(this, 'PipeRole', {
      assumedBy: new iam.ServicePrincipal('pipes.amazonaws.com'),
      description: 'EventBridge Pipe: DynamoDB stream to enrichment to event bus',
    })
    props.movementsTable.grantStreamRead(pipeRole)
    enrichment.grantInvoke(pipeRole)
    this.eventBus.grantPutEventsTo(pipeRole)

    if (!props.movementsTable.tableStreamArn) {
      throw new Error('Movements table must have a stream enabled')
    }

    const pipe = new pipes.CfnPipe(this, 'LedgerToBus', {
      roleArn: pipeRole.roleArn,
      source: props.movementsTable.tableStreamArn,
      sourceParameters: {
        dynamoDbStreamParameters: {
          startingPosition: 'LATEST',
          batchSize: 10,
        },
        filterCriteria: {
          filters: [
            {
              // Only EVENT items — CURRENT/HISTORY snapshots must not become domain events.
              pattern: JSON.stringify({
                dynamodb: { NewImage: { itemType: { S: ['EVENT'] } } },
              }),
            },
          ],
        },
      },
      enrichment: enrichment.functionArn,
      target: this.eventBus.eventBusArn,
      targetParameters: {
        eventBridgeEventBusParameters: {
          detailType: 'WasteMovementEvent',
          source: 'dwt.movements',
        },
      },
    })
    pipe.node.addDependency(pipeRole)
    pipe.node.addDependency(enrichment)

    this.movementStream = new kinesis.Stream(this, 'MovementStream', {
      streamName: 'dwt-waste-movements',
      shardCount: 1,
      retentionPeriod: Duration.days(7),
      encryption: kinesis.StreamEncryption.MANAGED,
    })

    new events.Rule(this, 'ToKinesis', {
      eventBus: this.eventBus,
      description: 'All waste-movement events → Kinesis (then Parquet lake)',
      eventPattern: {
        source: ['dwt.movements'],
        detailType: ['WasteMovementEvent'],
      },
      targets: [
        new targets.KinesisStream(this.movementStream, {
          // Send the envelope, not the EventBridge wrapper, so Glue columns match.
          message: events.RuleTargetInput.fromEventPath('$.detail'),
        }),
      ],
    })

    this.lakeBucket = new s3.Bucket(this, 'Lake', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    new ParquetFirehose(this, 'ParquetLake', {
      sourceStream: this.movementStream,
      lakeBucket: this.lakeBucket,
    })

    new CfnOutput(this, 'EventBusName', { value: this.eventBus.eventBusName })
    new CfnOutput(this, 'LakeBucketName', { value: this.lakeBucket.bucketName })
    new CfnOutput(this, 'KinesisStreamName', { value: this.movementStream.streamName })
  }
}
