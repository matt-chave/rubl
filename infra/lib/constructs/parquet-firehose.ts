/**
 * Kinesis Data Firehose that converts the movement envelope to Parquet.
 *
 * Nested, evolving OpenAPI bodies are a poor Glue schema, so the table is
 * the canonical envelope with `payload` as a JSON string. Athena can still
 * json_parse(payload) when a report needs a field.
 *
 * Failed conversions land under the S3 error prefix rather than blocking
 * the Kinesis stream — ingestion has already succeeded by this point.
 */

import { RemovalPolicy, Stack } from 'aws-cdk-lib'
import * as glue from 'aws-cdk-lib/aws-glue'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as firehose from 'aws-cdk-lib/aws-kinesisfirehose'
import * as kinesis from 'aws-cdk-lib/aws-kinesis'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'

export interface ParquetFirehoseProps {
  sourceStream: kinesis.IStream
  lakeBucket: s3.IBucket
}

export class ParquetFirehose extends Construct {
  public readonly deliveryStreamName: string
  public readonly glueDatabase: glue.CfnDatabase
  public readonly glueTable: glue.CfnTable

  constructor(scope: Construct, id: string, props: ParquetFirehoseProps) {
    super(scope, id)

    const stack = Stack.of(this)

    this.glueDatabase = new glue.CfnDatabase(this, 'LakeDb', {
      catalogId: stack.account,
      databaseInput: {
        name: 'dwt_lake',
        description: 'Digital Waste Tracking event lake (envelope + JSON payload)',
      },
    })

    this.glueTable = new glue.CfnTable(this, 'EventsTable', {
      catalogId: stack.account,
      databaseName: 'dwt_lake',
      tableInput: {
        name: 'waste_movement_events',
        tableType: 'EXTERNAL_TABLE',
        storageDescriptor: {
          columns: [
            { name: 'eventType', type: 'string' },
            { name: 'eventId', type: 'string' },
            { name: 'occurredAt', type: 'string' },
            { name: 'publicId', type: 'string' },
            { name: 'apiCode', type: 'string' },
            { name: 'payload', type: 'string' },
          ],
          location: `s3://${props.lakeBucket.bucketName}/events/`,
          inputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat',
          outputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat',
          serdeInfo: {
            serializationLibrary: 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe',
          },
        },
      },
    })
    this.glueTable.addResourceDependency(this.glueDatabase)

    const logGroup = new logs.LogGroup(this, 'FirehoseLogs', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const role = new iam.Role(this, 'FirehoseRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
      description: 'Firehose reads Kinesis, writes Parquet to S3, reads Glue schema',
    })
    props.sourceStream.grantRead(role)
    props.lakeBucket.grantReadWrite(role)
    logGroup.grantWrite(role)
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['glue:GetTable', 'glue:GetTableVersion', 'glue:GetTableVersions'],
        resources: ['*'],
      }),
    )

    const stream = new firehose.CfnDeliveryStream(this, 'Stream', {
      deliveryStreamType: 'KinesisStreamAsSource',
      kinesisStreamSourceConfiguration: {
        kinesisStreamArn: props.sourceStream.streamArn,
        roleArn: role.roleArn,
      },
      extendedS3DestinationConfiguration: {
        bucketArn: props.lakeBucket.bucketArn,
        roleArn: role.roleArn,
        prefix: 'events/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/',
        errorOutputPrefix: 'errors/!{firehose:error-output-type}/year=!{timestamp:yyyy}/month=!{timestamp:MM}/',
        bufferingHints: {
          intervalInSeconds: 60,
          sizeInMBs: 64,
        },
        compressionFormat: 'UNCOMPRESSED', // Parquet is already compressed
        cloudWatchLoggingOptions: {
          enabled: true,
          logGroupName: logGroup.logGroupName,
          logStreamName: 's3-delivery',
        },
        dataFormatConversionConfiguration: {
          enabled: true,
          inputFormatConfiguration: {
            deserializer: { openXJsonSerDe: {} },
          },
          outputFormatConfiguration: {
            serializer: { parquetSerDe: {} },
          },
          schemaConfiguration: {
            databaseName: 'dwt_lake',
            tableName: 'waste_movement_events',
            roleArn: role.roleArn,
            region: stack.region,
            catalogId: stack.account,
            versionId: 'LATEST',
          },
        },
      },
    })
    stream.addResourceDependency(this.glueTable)
    stream.node.addDependency(role)

    this.deliveryStreamName = stream.ref
  }
}
