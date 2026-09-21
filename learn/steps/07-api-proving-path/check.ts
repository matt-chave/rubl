import { assert, section } from '../../lib/assert'
import { awsJson, requireAws } from '../../lib/aws'

requireAws()
section('DwtApi stack')
const stacks = awsJson(['cloudformation', 'describe-stacks', '--stack-name', 'DwtApi']) as {
  Stacks: { StackStatus: string; Outputs?: { OutputKey: string }[] }[]
}
const stack = stacks.Stacks[0]
assert(stack.StackStatus.includes('COMPLETE'), `DwtApi status is ${stack.StackStatus}`)
const keys = (stack.Outputs ?? []).map((o) => o.OutputKey)
assert(keys.includes('ApiBaseUrl'), 'ApiBaseUrl output missing')
assert(keys.includes('ApiKeySecretArn'), 'ApiKeySecretArn output missing')

console.log('Step 07 automated checks passed.')
console.log('Do the curl in the README — the runner cannot hold your client secret.')
