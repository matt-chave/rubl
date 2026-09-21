import { assert, section } from '../../lib/assert'
import { awsJson, requireAws } from '../../lib/aws'

const id = requireAws()
section(`AWS identity ${id.account}`)

section('DwtAuth stack')
const stacks = awsJson(['cloudformation', 'describe-stacks', '--stack-name', 'DwtAuth']) as {
  Stacks: { StackStatus: string; Outputs?: { OutputKey: string }[] }[]
}
const stack = stacks.Stacks[0]
assert(stack.StackStatus.includes('COMPLETE'), `DwtAuth status is ${stack.StackStatus}`)
const keys = (stack.Outputs ?? []).map((o) => o.OutputKey)
assert(keys.includes('UserPoolId'), 'DwtAuth outputs should include UserPoolId')
assert(keys.includes('TokenUrl'), 'DwtAuth outputs should include TokenUrl')
console.log(`    status ${stack.StackStatus}`)

console.log('Step 05 automated checks passed.')
