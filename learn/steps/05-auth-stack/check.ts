import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assert, section } from '../../lib/assert'
import { awsJson, requireAws } from '../../lib/aws'
import { REPO_ROOT } from '../../lib/progress'

const id = requireAws()
section(`AWS identity ${id.account}`)

section('DwtAuth stack')
const authStacks = awsJson(['cloudformation', 'describe-stacks', '--stack-name', 'DwtAuth']) as {
  Stacks: { StackStatus: string; Outputs?: { OutputKey: string }[] }[]
}
const auth = authStacks.Stacks[0]
assert(auth.StackStatus.includes('COMPLETE'), `DwtAuth status is ${auth.StackStatus}`)
const authKeys = (auth.Outputs ?? []).map((o) => o.OutputKey)
assert(authKeys.includes('UserPoolId'), 'DwtAuth outputs should include UserPoolId')
assert(authKeys.includes('TokenUrl'), 'DwtAuth outputs should include TokenUrl')
console.log(`    status ${auth.StackStatus}`)

section('DwtOnboarding stack')
const onboardingStacks = awsJson([
  'cloudformation',
  'describe-stacks',
  '--stack-name',
  'DwtOnboarding',
]) as {
  Stacks: { StackStatus: string; Outputs?: { OutputKey: string }[] }[]
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
console.log(`    status ${onboarding.StackStatus}`)

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
console.log('Walk the signup form (or Bruno/curl) and Get token yourself. The runner never asks for a client secret.')
