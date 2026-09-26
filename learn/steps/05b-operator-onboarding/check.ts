import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assert, section } from '../../lib/assert'
import { awsJson, requireAws } from '../../lib/aws'
import { REPO_ROOT } from '../../lib/progress'

type CfOutput = { OutputKey: string; OutputValue?: string }

function outputValue(outputs: CfOutput[] | undefined, key: string): string {
  const value = outputs?.find((o) => o.OutputKey === key)?.OutputValue
  assert(value, `Missing CloudFormation output ${key}`)
  return value
}

requireAws()

section('DwtOnboarding stack')
const stacks = awsJson(['cloudformation', 'describe-stacks', '--stack-name', 'DwtOnboarding']) as {
  Stacks: { StackStatus: string; Outputs?: CfOutput[] }[]
}
const stack = stacks.Stacks[0]
assert(stack.StackStatus.includes('COMPLETE'), `DwtOnboarding status is ${stack.StackStatus}`)
const keys = (stack.Outputs ?? []).map((o) => o.OutputKey)
assert(keys.includes('OperatorsTableName'), 'OperatorsTableName output missing')
assert(keys.includes('OperatorsUsagePlanId'), 'OperatorsUsagePlanId output missing')
assert(keys.includes('OnboardingApiBaseUrl'), 'OnboardingApiBaseUrl output missing')
const operatorsTable = outputValue(stack.Outputs, 'OperatorsTableName')
const usagePlanId = outputValue(stack.Outputs, 'OperatorsUsagePlanId')
console.log(`    status ${stack.StackStatus}`)

section('Operators usage plan dwt-operators')
const plan = awsJson(['apigateway', 'get-usage-plan', '--usage-plan-id', usagePlanId]) as {
  name?: string
  id?: string
}
assert(plan.name === 'dwt-operators', `Expected usage plan name dwt-operators, got ${plan.name}`)
console.log(`    usage plan ${plan.id}`)

const planKeys = awsJson([
  'apigateway',
  'get-usage-plan-keys',
  '--usage-plan-id',
  usagePlanId,
  '--limit',
  '100',
]) as { items?: { id?: string; name?: string }[] }
const usageKeys = planKeys.items ?? []
const sandboxKey = usageKeys.find((k) => k.name === 'dwt-operator-sandbox')
if (sandboxKey?.id) {
  console.log(`    sandbox key id ${sandboxKey.id} (kept for later lessons)`)
}
const signupKeys = usageKeys.filter(
  (k) => typeof k.name === 'string' && k.name.startsWith('dwt-operator-') && k.name !== 'dwt-operator-sandbox',
)
if (signupKeys.length > 0) {
  console.log(
    `    self-signup API keys: ${signupKeys.map((k) => `${k.name} (${k.id})`).join(', ')}`,
  )
}

section('Operators table and registered operator')
const tableDesc = awsJson(['dynamodb', 'describe-table', '--table-name', operatorsTable]) as {
  Table?: { TableStatus?: string }
}
assert(tableDesc.Table?.TableStatus === 'ACTIVE', `Operators table status is ${tableDesc.Table?.TableStatus}`)
console.log(`    table ${operatorsTable}`)

const scanned = awsJson([
  'dynamodb',
  'scan',
  '--table-name',
  operatorsTable,
  '--projection-expression',
  'PK, operatorId, apiKeyId, apiKeyName',
  '--query',
  'Items[*].{PK:PK.S,operatorId:operatorId.S,apiKeyId:apiKeyId.S,apiKeyName:apiKeyName.S}',
]) as
  | { PK?: string; operatorId?: string; apiKeyId?: string; apiKeyName?: string }[]
  | null
const profiles = (scanned ?? []).filter(
  (item) =>
    typeof item.PK === 'string' &&
    item.PK.startsWith('OPERATOR#') &&
    typeof item.apiKeyId === 'string' &&
    item.apiKeyId.length > 0 &&
    typeof item.apiKeyName === 'string' &&
    item.apiKeyName.startsWith('dwt-operator-') &&
    item.apiKeyName !== 'dwt-operator-sandbox',
)
assert(
  profiles.length > 0,
  'Operators table has no self-signup rows. Register a waste operator (form or curl) before npm run learn -- 05b.',
)

const keyIds = new Set(usageKeys.map((k) => k.id).filter(Boolean) as string[])
const matched = profiles.filter((p) => keyIds.has(p.apiKeyId!))
assert(
  matched.length > 0,
  'No Operators row has an apiKeyId that exists on usage plan dwt-operators.',
)
const named = matched.find((p) =>
  signupKeys.some((k) => k.id === p.apiKeyId && k.name === p.apiKeyName),
)
assert(
  named,
  'Expected an Operators row whose apiKeyName matches a non-sandbox key on usage plan dwt-operators.',
)
console.log(
  `    registered operator ${named.PK} → apiKeyId ${named.apiKeyId} (${named.apiKeyName})`,
)

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
const putIdx = operatorsOp.indexOf('PutCommand')
assert(putIdx >= 0, 'Operator signup should call PutCommand')
const returnIdx = operatorsOp.indexOf('\n  return', putIdx)
const putBlock = operatorsOp.slice(putIdx, returnIdx > putIdx ? returnIdx : undefined)
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
