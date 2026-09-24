import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assert, section } from '../../lib/assert'
import { awsJson, requireAws } from '../../lib/aws'
import { REPO_ROOT } from '../../lib/progress'

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
assert(keys.includes('SandboxOperatorId'), 'SandboxOperatorId output missing')

section('CDK source')
const api = readFileSync(join(REPO_ROOT, 'infra/lib/stacks/api-stack.ts'), 'utf8')
assert(api.includes('dwt-operator-sandbox'), 'api-stack.ts should seed the sandbox operator API key')
assert(api.includes('dwt-operators') || api.includes('operatorsUsagePlan'), 'api-stack.ts should attach the onboarding operators usage plan')
assert(api.includes('OPERATORS_TABLE'), 'api-stack.ts should pass OPERATORS_TABLE to movements Lambdas')

console.log('Step 07 automated checks passed.')
console.log('Walk Get token and Create movement in Bruno (see the README). The runner cannot hold your client secret.')
