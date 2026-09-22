/**
 * Regulatory lake: bronze JSON (Firehose) then silver Parquet (Glue job).
 *
 * Firehose must not convert at ingest. The OpenAPI body evolves; a Glue
 * schema at write time would send new records to errors/ and you would
 * lose the only copy. Bronze is the durable landing zone. Silver is an
 * on-demand job you can rerun after the transform changes.
 */

import * as path from 'path'
import { RemovalPolicy, Stack } from 'aws-cdk-lib'
import * as glue from 'aws-cdk-lib/aws-glue'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as firehose from 'aws-cdk-lib/aws-kinesisfirehose'
import * as kinesis from 'aws-cdk-lib/aws-kinesis'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3assets from 'aws-cdk-lib/aws-s3-assets'
import { Construct } from 'constructs'

export interface MovementLakeProps {
  sourceStream: kinesis.IStream
  lakeBucket: s3.IBucket
}

export class MovementLake extends Construct {
  public readonly glueDatabase: glue.CfnDatabase
  public readonly silverJobName: string

  constructor(scope: Construct, id: string, props: MovementLakeProps) {
    super(scope, id)

    const stack = Stack.of(this)
    const bronzePrefix = 'bronze/events/'
    const silverPrefix = 'silver/events/'

    this.glueDatabase = new glue.CfnDatabase(this, 'LakeDb', {
      catalogId: stack.account,
      databaseInput: {
        name: 'dwt_lake',
        description: 'Digital Waste Tracking lake — bronze JSON, silver Parquet',
      },
    })

    const firehoseLogGroup = new logs.LogGroup(this, 'FirehoseLogs', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const firehoseRole = new iam.Role(this, 'FirehoseRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
      description: 'Firehose reads Kinesis and writes JSONL to bronze/',
    })
    props.sourceStream.grantRead(firehoseRole)
    props.lakeBucket.grantReadWrite(firehoseRole)
    firehoseLogGroup.grantWrite(firehoseRole)

    const stream = new firehose.CfnDeliveryStream(this, 'BronzeStream', {
      deliveryStreamType: 'KinesisStreamAsSource',
      kinesisStreamSourceConfiguration: {
        kinesisStreamArn: props.sourceStream.streamArn,
        roleArn: firehoseRole.roleArn,
      },
      extendedS3DestinationConfiguration: {
        bucketArn: props.lakeBucket.bucketArn,
        roleArn: firehoseRole.roleArn,
        prefix: `${bronzePrefix}year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/`,
        errorOutputPrefix:
          'bronze/errors/!{firehose:error-output-type}/year=!{timestamp:yyyy}/month=!{timestamp:MM}/',
        bufferingHints: {
          intervalInSeconds: 60,
          sizeInMBs: 1,
        },
        compressionFormat: 'UNCOMPRESSED',
        cloudWatchLoggingOptions: {
          enabled: true,
          logGroupName: firehoseLogGroup.logGroupName,
          logStreamName: 's3-delivery',
        },
        // One JSON object per line so Spark / Athena can read bronze as JSONL.
        processingConfiguration: {
          enabled: true,
          processors: [{ type: 'AppendDelimiterToRecord' }],
        },
      },
    })
    stream.node.addDependency(firehoseRole)

    const script = new s3assets.Asset(this, 'SilverScript', {
      path: path.join(__dirname, '../../glue/bronze_to_silver.py'),
    })

    const jobRole = new iam.Role(this, 'SilverJobRole', {
      assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
      description: 'Glue ETL: bronze JSON to silver Parquet',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'),
      ],
    })
    props.lakeBucket.grantReadWrite(jobRole)
    script.grantRead(jobRole)
    jobRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'glue:GetDatabase',
          'glue:GetTable',
          'glue:CreateTable',
          'glue:UpdateTable',
          'glue:GetPartition',
          'glue:CreatePartition',
          'glue:UpdatePartition',
          'glue:BatchCreatePartition',
        ],
        resources: ['*'],
      }),
    )

    const job = new glue.CfnJob(this, 'BronzeToSilver', {
      name: 'dwt-bronze-to-silver',
      role: jobRole.roleArn,
      command: {
        name: 'glueetl',
        pythonVersion: '3',
        scriptLocation: script.s3ObjectUrl,
      },
      glueVersion: '4.0',
      workerType: 'G.1X',
      numberOfWorkers: 2,
      timeout: 20,
      executionProperty: { maxConcurrentRuns: 1 },
      defaultArguments: {
        '--job-language': 'python',
        '--job-bookmark-option': 'job-bookmark-disable',
        '--enable-metrics': 'true',
        '--BRONZE_PATH': `s3://${props.lakeBucket.bucketName}/${bronzePrefix}`,
        '--SILVER_PATH': `s3://${props.lakeBucket.bucketName}/${silverPrefix}`,
      },
    })
    job.addResourceDependency(this.glueDatabase)
    job.node.addDependency(jobRole)

    this.silverJobName = job.ref
  }
}
