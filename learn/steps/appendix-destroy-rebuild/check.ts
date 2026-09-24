/**
 * Optional appendix check. It only describes CloudFormation in eu-west-2.
 * It never runs cdk destroy or cdk deploy, and it never writes progress.json.
 */
import { assert, section } from '../../lib/assert'
import { describeStack, requireAws, type StackSummary } from '../../lib/aws'

const DWT_STACKS = [
  'DwtAuth',
  'DwtOnboarding',
  'DwtLedger',
  'DwtApi',
  'DwtEvents',
  'DwtCharging',
] as const
const HEALTHY = new Set(['CREATE_COMPLETE', 'UPDATE_COMPLETE'])
const AUTH_OUTPUTS = ['TokenUrl', 'ClientId']
const API_OUTPUTS = ['ApiBaseUrl', 'ApiKeySecretArn', 'SandboxOperatorId']
const ONBOARDING_OUTPUTS = ['OnboardingApiBaseUrl', 'OperatorsUsagePlanId']

function requireSandboxProfile(): void {
  const profile = process.env.AWS_PROFILE?.trim()
  if (!profile) {
    throw new Error(
      [
        'Set AWS_PROFILE to your sandbox profile before this check (usually dwt-dev).',
        'A missing profile is not success — the runner must not guess another account.',
        'Example: export AWS_PROFILE=dwt-dev',
        'Do not paste access keys or sts JSON into chat.',
      ].join('\n'),
    )
  }
  if (/prod/i.test(profile)) {
    throw new Error(
      `AWS_PROFILE=${profile} looks like production. Stop. This appendix is sandbox only.`,
    )
  }
}

function outputKeys(stack: StackSummary | undefined): string[] {
  return (stack?.Outputs ?? []).map((output) => output.OutputKey)
}

function printStatuses(): void {
  section('Current Dwt* stacks (eu-west-2)')
  for (const name of DWT_STACKS) {
    const stack = describeStack(name)
    const label = stack ? stack.StackStatus : 'not present'
    console.log(`    ${name}  ${label}`)
  }
  const toolkit = describeStack('CDKToolkit')
  console.log(`    CDKToolkit  ${toolkit ? toolkit.StackStatus : 'not present (bootstrap if you still need to deploy)'}`)
}

function checkDestroy(): void {
  section('Destroy: Dwt* stacks gone')
  const stillHere: string[] = []
  const inFlight: string[] = []
  const failed: string[] = []

  for (const name of DWT_STACKS) {
    const stack = describeStack(name)
    if (!stack || stack.StackStatus === 'DELETE_COMPLETE') {
      console.log(`    ${name}  gone`)
      continue
    }
    if (stack.StackStatus === 'DELETE_IN_PROGRESS') {
      inFlight.push(`${name} (${stack.StackStatus})`)
      continue
    }
    if (stack.StackStatus.includes('DELETE_FAILED') || stack.StackStatus.includes('FAILED')) {
      failed.push(`${name} is ${stack.StackStatus}`)
      continue
    }
    stillHere.push(`${name} is ${stack.StackStatus}`)
  }

  if (inFlight.length) {
    throw new Error(
      `Delete still running. Wait, then re-run this check.\n  ${inFlight.join('\n  ')}`,
    )
  }
  if (failed.length) {
    throw new Error(
      [
        'A stack failed to delete. Look at CloudFormation in eu-west-2 (often a versioned lake bucket).',
        ...failed.map((line) => `  ${line}`),
        'Empty current objects and previous versions, then destroy the remaining stacks. This check does not delete anything.',
      ].join('\n'),
    )
  }
  if (stillHere.length) {
    throw new Error(
      [
        'Destroy is not finished. These stacks are still present:',
        ...stillHere.map((line) => `  ${line}`),
        'Dependents first: npx cdk destroy DwtApi DwtCharging DwtEvents DwtLedger DwtOnboarding DwtAuth',
        'This check does not run destroy for you.',
      ].join('\n'),
    )
  }

  const toolkit = describeStack('CDKToolkit')
  if (!toolkit) {
    console.log('    CDKToolkit is missing. Leave bootstrap alone next time; run cdk bootstrap before rebuild.')
  } else {
    console.log(`    CDKToolkit still ${toolkit.StackStatus} (expected)`)
  }

  console.log('Appendix destroy check passed. The Dwt* stacks are gone.')
  console.log('Deploy next, one stack per lesson: Auth → Onboarding → Ledger → Api → Events → Charging.')
}

function checkRebuild(): void {
  section('Rebuild: Dwt* stacks healthy')
  const missing: string[] = []
  const unhealthy: string[] = []

  for (const name of DWT_STACKS) {
    const stack = describeStack(name)
    if (!stack || stack.StackStatus === 'DELETE_COMPLETE') {
      missing.push(name)
      console.log(`    ${name}  not present`)
      continue
    }
    if (!HEALTHY.has(stack.StackStatus)) {
      unhealthy.push(`${name} is ${stack.StackStatus}`)
      console.log(`    ${name}  ${stack.StackStatus}`)
      continue
    }
    console.log(`    ${name}  ${stack.StackStatus}`)
  }

  if (missing.length) {
    const next = missing[0]
    throw new Error(
      [
        'Rebuild is not finished. Deploy the next stack in lesson order, not --all.',
        `  Next: npx cdk deploy ${next}`,
        `  Still missing: ${missing.join(', ')}`,
        'Order is DwtAuth → DwtOnboarding → DwtLedger → DwtApi → DwtEvents → DwtCharging.',
        'This check does not deploy for you.',
      ].join('\n'),
    )
  }
  if (unhealthy.length) {
    throw new Error(
      [
        'A stack is not CREATE_COMPLETE or UPDATE_COMPLETE yet.',
        ...unhealthy.map((line) => `  ${line}`),
        'Wait for CloudFormation, or fix a rollback, then re-run this check.',
      ].join('\n'),
    )
  }

  section('DwtAuth outputs')
  const auth = describeStack('DwtAuth')
  const authKeys = outputKeys(auth)
  for (const key of AUTH_OUTPUTS) {
    assert(authKeys.includes(key), `DwtAuth is missing output ${key}`)
  }
  console.log(`    ${AUTH_OUTPUTS.join(', ')}`)

  section('DwtOnboarding outputs')
  const onboarding = describeStack('DwtOnboarding')
  const onboardingKeys = outputKeys(onboarding)
  for (const key of ONBOARDING_OUTPUTS) {
    assert(onboardingKeys.includes(key), `DwtOnboarding is missing output ${key}`)
  }
  console.log(`    ${ONBOARDING_OUTPUTS.join(', ')}`)

  section('DwtApi outputs (operator model)')
  const api = describeStack('DwtApi')
  const apiKeys = outputKeys(api)
  for (const key of API_OUTPUTS) {
    assert(apiKeys.includes(key), `DwtApi is missing output ${key} — deploy DwtApi again after the operator-key change`)
  }
  console.log(`    ${API_OUTPUTS.join(', ')}`)

  console.log('Appendix rebuild check passed. Copy the new Cognito secret and operator API key into Bruno, then Get token.')
}

requireSandboxProfile()
requireAws()

const mode = (process.argv[2] ?? '').replace(/^--/, '')
if (mode === 'destroy') {
  checkDestroy()
} else if (mode === 'rebuild') {
  checkRebuild()
} else {
  printStatuses()
  throw new Error(
    [
      'Pass destroy or rebuild so this check has a target.',
      '  npm run learn -- appendix-destroy-rebuild destroy',
      '  npm run learn -- appendix-destroy-rebuild rebuild',
      'A status-only run is not treated as success.',
    ].join('\n'),
  )
}
