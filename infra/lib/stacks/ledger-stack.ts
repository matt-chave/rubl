/**
 * LedgerStack — Core Movements Ledger data plane.
 *
 * movements: append-only EVENT items + CURRENT snapshot per aggregate.
 * history: PUT snapshots (OpenAPI "revision counter" rule).
 * sequences: atomic counters that feed year-prefixed sqids.
 * reference: placeholder table if taxonomy later moves off bundled JSON.
 *
 * Streams NEW_IMAGE so EventBridge Pipes can publish after a durable write
 * — the Lambda never dual-writes to the bus.
 */

import { RemovalPolicy, Stack, StackProps, CfnOutput } from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'

export class LedgerStack extends Stack {
  public readonly movementsTable: dynamodb.Table
  public readonly historyTable: dynamodb.Table
  public readonly sequenceTable: dynamodb.Table
  public readonly referenceTable: dynamodb.Table

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    this.movementsTable = new dynamodb.Table(this, 'Movements', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
    })
    this.movementsTable.addGlobalSecondaryIndex({
      indexName: 'gsi1',
      partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    this.historyTable = new dynamodb.Table(this, 'History', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    this.sequenceTable = new dynamodb.Table(this, 'Sequences', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    this.referenceTable = new dynamodb.Table(this, 'Reference', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    new CfnOutput(this, 'MovementsTableName', { value: this.movementsTable.tableName })
    new CfnOutput(this, 'MovementsTableStreamArn', {
      value: this.movementsTable.tableStreamArn ?? 'stream-not-enabled',
    })
  }
}
