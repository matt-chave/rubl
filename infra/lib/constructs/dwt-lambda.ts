/**
 * One Node.js 22 Lambda per OpenAPI operationId (used by DwtApi).
 *
 * Entry is src/lambdas/<operationId>/index.ts. Shared code is bundled from
 * src/lib by esbuild — there is no Lambda layer. Table names come in as
 * env vars; IAM is grantReadWriteData on movements / history / sequences.
 * Auth is at API Gateway, not in this construct.
 */

import * as path from 'path'
import { Duration, RemovalPolicy } from 'aws-cdk-lib'
import { Runtime, Tracing } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Construct } from 'constructs'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as logs from 'aws-cdk-lib/aws-logs'

export interface DwtLambdaProps {
  /** Folder name under src/lambdas — must match OpenAPI operationId. */
  operationId: string
  description: string
  tables?: {
    movements: dynamodb.ITable
    history: dynamodb.ITable
    sequences: dynamodb.ITable
  }
  extraEnv?: Record<string, string>
  timeout?: Duration
  memorySize?: number
}

const ROOT = path.join(__dirname, '../../..')

export class DwtLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: DwtLambdaProps) {
    const environment: Record<string, string> = { ...props.extraEnv }
    if (props.tables) {
      environment.MOVEMENTS_TABLE = props.tables.movements.tableName
      environment.HISTORY_TABLE = props.tables.history.tableName
      environment.SEQUENCE_TABLE = props.tables.sequences.tableName
    }

    super(scope, id, {
      entry: path.join(ROOT, 'src/lambdas', props.operationId, 'index.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      timeout: props.timeout ?? Duration.seconds(15),
      memorySize: props.memorySize ?? 256,
      tracing: Tracing.ACTIVE,
      description: props.description,
      environment,
      logGroup: new logs.LogGroup(scope, `${id}LogGroup`, {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node22',
        format: OutputFormat.CJS,
        // Bundle the SDK so synth/deploy does not depend on which clients
        // the Lambda Node 22 runtime happens to include.
        forceDockerBundling: false,
      },
      depsLockFilePath: path.join(ROOT, 'package-lock.json'),
      projectRoot: ROOT,
    })

    if (props.tables) {
      props.tables.movements.grantReadWriteData(this)
      props.tables.history.grantReadWriteData(this)
      props.tables.sequences.grantReadWriteData(this)
    }
  }
}
