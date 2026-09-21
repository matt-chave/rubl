import { assert, section } from '../../lib/assert'
import { awsJson, requireAws } from '../../lib/aws'

requireAws()
section('DwtCharging stack')
const stacks = awsJson(['cloudformation', 'describe-stacks', '--stack-name', 'DwtCharging']) as {
  Stacks: { StackStatus: string; Outputs?: { OutputKey: string }[] }[]
}
const stack = stacks.Stacks[0]
assert(stack.StackStatus.includes('COMPLETE'), `DwtCharging status is ${stack.StackStatus}`)
const keys = (stack.Outputs ?? []).map((o) => o.OutputKey)
assert(keys.includes('OperatorLedgerTableName'), 'OperatorLedgerTableName missing')
assert(keys.includes('ChargingQueueUrl'), 'ChargingQueueUrl missing')
assert(keys.includes('ChargingDlqUrl'), 'ChargingDlqUrl missing')

console.log('Step 09 automated checks passed.')
