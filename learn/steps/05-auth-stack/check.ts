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

const id = requireAws()
section(`AWS identity ${id.account}`)

section('DwtAuth stack')
const authStacks = awsJson(['cloudformation', 'describe-stacks', '--stack-name', 'DwtAuth']) as {
  Stacks: { StackStatus: string; Outputs?: CfOutput[] }[]
}
const auth = authStacks.Stacks[0]
assert(auth.StackStatus.includes('COMPLETE'), `DwtAuth status is ${auth.StackStatus}`)
const authKeys = (auth.Outputs ?? []).map((o) => o.OutputKey)
assert(authKeys.includes('UserPoolId'), 'DwtAuth outputs should include UserPoolId')
assert(authKeys.includes('TokenUrl'), 'DwtAuth outputs should include TokenUrl')
const userPoolId = outputValue(auth.Outputs, 'UserPoolId')
console.log(`    status ${auth.StackStatus}`)

section('DwtOnboarding stack')
const onboardingStacks = awsJson([
  'cloudformation',
  'describe-stacks',
  '--stack-name',
  'DwtOnboarding',
]) as {
  Stacks: { StackStatus: string; Outputs?: CfOutput[] }[]
}
const onboarding = onboardingStacks.Stacks[0]
assert(
  onboarding.StackStatus.includes('COMPLETE'),
  `DwtOnboarding status is ${onboarding.StackStatus}`,
)
const onboardingKeys = (onboarding.Outputs ?? []).map((o) => o.OutputKey)
assert(
  onboardingKeys.includes('OnboardingApiBaseUrl'),
  'DwtOnboarding outputs should include OnboardingApiBaseUrl',
)
assert(
  onboardingKeys.includes('SoftwareProvidersTableName'),
  'DwtOnboarding outputs should include SoftwareProvidersTableName',
)
const softwareProvidersTable = outputValue(onboarding.Outputs, 'SoftwareProvidersTableName')
console.log(`    status ${onboarding.StackStatus}`)

section('Cognito pool dwt-vendor-m2m app clients')
const pool = awsJson(['cognito-idp', 'describe-user-pool', '--user-pool-id', userPoolId]) as {
  UserPool?: { Name?: string }
}
assert(pool.UserPool?.Name === 'dwt-vendor-m2m', `Expected pool name dwt-vendor-m2m, got ${pool.UserPool?.Name}`)
const listed = awsJson([
  'cognito-idp',
  'list-user-pool-clients',
  '--user-pool-id',
  userPoolId,
  '--max-results',
  '60',
]) as { UserPoolClients?: { ClientId?: string; ClientName?: string }[] }
const appClients = listed.UserPoolClients ?? []
assert(appClients.length > 0, 'User pool should list at least one app client')
const sandbox = appClients.find((c) => c.ClientName === 'dwt-vendor-software')
assert(sandbox?.ClientId, 'Sandbox app client dwt-vendor-software should exist on the pool')
console.log(`    sandbox client ${sandbox.ClientId}`)
const providerClients = appClients.filter((c) => (c.ClientName ?? '').startsWith('dwt-provider-'))
if (providerClients.length > 0) {
  console.log(
    `    self-signup app clients: ${providerClients.map((c) => `${c.ClientName} (${c.ClientId})`).join(', ')}`,
  )
}

section('SoftwareProviders table and registered provider')
const tableDesc = awsJson(['dynamodb', 'describe-table', '--table-name', softwareProvidersTable]) as {
  Table?: { TableName?: string; TableStatus?: string }
}
assert(tableDesc.Table?.TableStatus === 'ACTIVE', `SoftwareProviders table status is ${tableDesc.Table?.TableStatus}`)
console.log(`    table ${softwareProvidersTable}`)

const scanned = awsJson([
  'dynamodb',
  'scan',
  '--table-name',
  softwareProvidersTable,
  '--projection-expression',
  'PK, clientId, clientName',
  '--query',
  'Items[*].{PK:PK.S,clientId:clientId.S,clientName:clientName.S}',
]) as { PK?: string; clientId?: string; clientName?: string }[] | null
const profiles = (scanned ?? []).filter(
  (item) =>
    typeof item.PK === 'string' &&
    item.PK.startsWith('SOFTWARE#') &&
    typeof item.clientId === 'string' &&
    item.clientId.length > 0,
)
assert(
  profiles.length > 0,
  'SoftwareProviders table has no signup rows. Register a software provider (form or curl) before npm run learn -- 05.',
)

const clientIds = new Set(appClients.map((c) => c.ClientId).filter(Boolean) as string[])
const matched = profiles.filter((p) => clientIds.has(p.clientId!))
assert(
  matched.length > 0,
  'No SoftwareProviders row has a clientId that exists as an app client on dwt-vendor-m2m.',
)
const namedProvider = matched.find(
  (p) =>
    typeof p.clientName === 'string' &&
    p.clientName.startsWith('dwt-provider-') &&
    providerClients.some((c) => c.ClientId === p.clientId),
)
assert(
  namedProvider,
  'Expected a SoftwareProviders row whose clientName starts with dwt-provider- and matches a Cognito app client.',
)
console.log(
  `    registered provider ${namedProvider.PK} → clientId ${namedProvider.clientId} (${namedProvider.clientName})`,
)

section('CDK source')
const onboardingSrc = readFileSync(join(REPO_ROOT, 'infra/lib/stacks/onboarding-stack.ts'), 'utf8')
assert(
  onboardingSrc.includes('CreateUserPoolClient') ||
    readFileSync(join(REPO_ROOT, 'src/lib/operations/software-providers.ts'), 'utf8').includes(
      'CreateUserPoolClient',
    ),
  'Software provider signup should declare CreateUserPoolClient',
)
assert(onboardingSrc.includes('software-providers'), 'Onboarding stack should expose software-providers')
assert(
  existsSync(join(REPO_ROOT, 'packages/dwt-mfe-software-provider-signup/src/elements.tsx')),
  'Missing dwt-software-provider-signup widget package',
)
const elements = readFileSync(
  join(REPO_ROOT, 'packages/dwt-mfe-software-provider-signup/src/elements.tsx'),
  'utf8',
)
assert(elements.includes('dwt-software-provider-signup'), 'Widget tag dwt-software-provider-signup missing')
assert(elements.includes('dwt-change') && elements.includes('dwt-submit'), 'Widget should emit dwt-change and dwt-submit')

console.log('Step 05 automated checks passed.')
console.log('Walk Get token yourself. The runner never asks for a client secret.')
