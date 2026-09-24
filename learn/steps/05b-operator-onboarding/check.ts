import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assert, section } from '../../lib/assert'
import { awsJson, requireAws } from '../../lib/aws'
import { REPO_ROOT } from '../../lib/progress'

requireAws()

section('DwtOnboarding stack')
const stacks = awsJson(['cloudformation', 'describe-stacks', '--stack-name', 'DwtOnboarding']) as {
  Stacks: { StackStatus: string; Outputs?: { OutputKey: string }[] }[]
}
const stack = stacks.Stacks[0]
assert(stack.StackStatus.includes('COMPLETE'), `DwtOnboarding status is ${stack.StackStatus}`)
const keys = (stack.Outputs ?? []).map((o) => o.OutputKey)
assert(keys.includes('OperatorsTableName'), 'OperatorsTableName output missing')
assert(keys.includes('OperatorsUsagePlanId'), 'OperatorsUsagePlanId output missing')
assert(keys.includes('OnboardingApiBaseUrl'), 'OnboardingApiBaseUrl output missing')
console.log(`    status ${stack.StackStatus}`)

section('CDK and identity source')
const onboarding = readFileSync(join(REPO_ROOT, 'infra/lib/stacks/onboarding-stack.ts'), 'utf8')
assert(onboarding.includes('dwt-operators'), 'Onboarding stack should create usage plan dwt-operators')
assert(onboarding.includes("'operators'") || onboarding.includes('"operators"'), 'Onboarding stack should expose /operators')
assert(onboarding.includes('Operators'), 'Onboarding stack should declare an Operators table')

const identity = readFileSync(join(REPO_ROOT, 'src/lib/identity.ts'), 'utf8')
assert(identity.includes('OPERATORS_TABLE'), 'identity.ts should look up operators from OPERATORS_TABLE')
assert(identity.includes('SANDBOX_API_KEY_ID'), 'identity.ts should still map the sandbox key')
assert(identity.includes('byApiKeyId') || identity.includes('apiKeyId'), 'identity.ts should resolve by apiKeyId')

const operatorsOp = readFileSync(join(REPO_ROOT, 'src/lib/operations/operators.ts'), 'utf8')
assert(operatorsOp.includes('CreateApiKey'), 'Operator signup should call CreateApiKey')
const putBlock = operatorsOp.slice(operatorsOp.indexOf('PutCommand'))
assert(putBlock.includes('apiKeyId'), 'Operator signup should store apiKeyId')
assert(!putBlock.includes('apiKey: apiKeyValue'), 'Operator signup must not store the API key value')
assert(operatorsOp.includes('apiKey: apiKeyValue'), 'Operator signup should return the key value once')

section('Operator signup widget')
assert(
  existsSync(join(REPO_ROOT, 'packages/dwt-mfe-operator-signup/src/elements.tsx')),
  'Missing dwt-operator-signup package',
)
const elements = readFileSync(join(REPO_ROOT, 'packages/dwt-mfe-operator-signup/src/elements.tsx'), 'utf8')
assert(elements.includes('dwt-operator-signup'), 'Widget tag dwt-operator-signup missing')
assert(elements.includes('dwt-change') && elements.includes('dwt-submit'), 'Widget should emit dwt-change and dwt-submit')

console.log('Step 05b automated checks passed.')
console.log('Walk the operator signup form (or Bruno/curl) yourself. The runner never asks for an API key value.')
