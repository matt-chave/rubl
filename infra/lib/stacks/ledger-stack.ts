/**
 * LedgerStack — Core Movements Ledger data plane (CDK stack id: DwtLedger).
 *
 * `cdk deploy DwtLedger` *creates* these DynamoDB tables. Do not click
 * Create table in the console first — the list should be empty until this
 * stack succeeds. This step deploys empty tables, not waste movements.
 * Rows arrive in step 07 via `src/lib/ledger.ts`.
 *
 * Application code must not UpdateItem EVENT rows. DynamoDB can overwrite;
 * we refuse to, so the legal trail stays an append-only log.
 *
 * Streams NEW_IMAGE so EventBridge Pipes (step 08) publish after a durable
 * write — the API Lambda never dual-writes to the bus.
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

    // Legal write path. PK and SK are *String* in the table schema — DynamoDB
    // does not store "MOVEMENT#" as a type. Prefixes are a convention in
    // src/lib/ledger.ts: PK = MOVEMENT#id (or DELIVERY# / LEGACY#);
    // SK = EVENT#… (append-only fact) or CURRENT (latest snapshot).
    // PAY_PER_REQUEST matches bursty ingest. Sandbox: DESTROY with the stack.
    // No tableName: CDK generates DwtLedger-Movements<hash>-<id> so deploys
    // do not collide. The construct id is still "Movements". Use stack
    // output MovementsTableName — do not type the hash by hand.
    this.movementsTable = new dynamodb.Table(this, 'Movements', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
    })
    // Alternate access path for queries that are not "by movement id".
    this.movementsTable.addGlobalSecondaryIndex({
      indexName: 'gsi1',
      partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // Copy of CURRENT taken *before* a PUT overwrites it (OpenAPI revision).
    this.historyTable = new dynamodb.Table(this, 'History', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    // One item per counter (PK = SEQUENCE#MOVEMENT etc). Atomic ADD mints
    // year-prefixed sqids under concurrent POSTs. No sort key.
    this.sequenceTable = new dynamodb.Table(this, 'Sequences', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    // Placeholder if EWC / taxonomy later leaves bundled JSON. Unused in this slice.
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
