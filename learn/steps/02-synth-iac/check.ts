import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assert, section } from '../../lib/assert'
import { REPO_ROOT } from '../../lib/progress'

section('cdk synth')
const synth = spawnSync('npx', ['cdk', 'synth'], { cwd: REPO_ROOT, stdio: 'inherit', shell: true })
assert(synth.status === 0, 'cdk synth failed')

const expected: Record<string, string> = {
  'DwtAuth.template.json': 'AWS::Cognito::UserPool',
  'DwtLedger.template.json': 'AWS::DynamoDB::Table',
  'DwtEvents.template.json': 'AWS::Events::EventBus',
  'DwtCharging.template.json': 'AWS::SQS::Queue',
  'DwtApi.template.json': 'AWS::ApiGateway::RestApi',
}

section('CloudFormation templates')
for (const [file, token] of Object.entries(expected)) {
  const path = join(REPO_ROOT, 'cdk.out', file)
  assert(existsSync(path), `Missing ${file} — synth did not emit this stack`)
  const body = readFileSync(path, 'utf8')
  assert(body.includes(token), `${file} does not contain ${token}`)
  console.log(`    ${file} contains ${token}`)
}

console.log('Step 02 automated checks passed.')
