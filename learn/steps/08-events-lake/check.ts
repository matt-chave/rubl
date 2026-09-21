import { assert, section } from '../../lib/assert'
import { awsJson, requireAws } from '../../lib/aws'

requireAws()
section('DwtEvents stack')
const stacks = awsJson(['cloudformation', 'describe-stacks', '--stack-name', 'DwtEvents']) as {
  Stacks: { StackStatus: string; Outputs?: { OutputKey: string }[] }[]
}
const stack = stacks.Stacks[0]
assert(stack.StackStatus.includes('COMPLETE'), `DwtEvents status is ${stack.StackStatus}`)
const keys = (stack.Outputs ?? []).map((o) => o.OutputKey)
assert(keys.includes('EventBusName'), 'EventBusName missing')
assert(keys.includes('LakeBucketName'), 'LakeBucketName missing')
assert(keys.includes('KinesisStreamName'), 'KinesisStreamName missing')

console.log('Step 08 automated checks passed.')
console.log('POST a movement, wait ~2 minutes, then aws s3 ls the lake bucket.')
