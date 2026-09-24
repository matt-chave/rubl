import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assert, section } from '../../lib/assert'
import { REPO_ROOT } from '../../lib/progress'

const architecturePath = join(REPO_ROOT, 'learn/architecture.md')

section('Architecture note')
assert(existsSync(architecturePath), 'Missing learn/architecture.md')
const body = readFileSync(architecturePath, 'utf8')

section('Scope of reporting a waste movement')
for (const token of ['Create', 'Collect', 'Deliver', 'Receive', 'Fate']) {
  assert(body.includes(token), `architecture.md must describe the ${token} stage`)
}

section('Stacks')
for (const stack of ['DwtAuth', 'DwtOnboarding', 'DwtLedger', 'DwtApi', 'DwtEvents', 'DwtCharging']) {
  assert(body.includes(stack), `architecture.md must name stack ${stack}`)
}

section('AWS components and why')
for (const token of [
  'Cognito',
  'API Gateway',
  'Lambda',
  'DynamoDB',
  'Streams',
  'EventBridge',
  'Kinesis',
  'Firehose',
  'SQS',
  'PutEvents',
]) {
  assert(body.includes(token), `architecture.md must explain ${token}`)
}

section('Stack source files still present')
for (const rel of [
  'infra/lib/stacks/auth-stack.ts',
  'infra/lib/stacks/onboarding-stack.ts',
  'infra/lib/stacks/ledger-stack.ts',
  'infra/lib/stacks/events-stack.ts',
  'infra/lib/stacks/charging-stack.ts',
  'infra/lib/stacks/api-stack.ts',
]) {
  assert(existsSync(join(REPO_ROOT, rel)), `Missing ${rel}`)
}

console.log('Step 02b automated checks passed.')
