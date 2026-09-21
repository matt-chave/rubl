import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assert, section } from '../../lib/assert'
import { awsJson, requireAws } from '../../lib/aws'
import { REPO_ROOT } from '../../lib/progress'

requireAws()

section('Prior stacks still present')
for (const name of ['DwtAuth', 'DwtLedger', 'DwtApi', 'DwtEvents', 'DwtCharging']) {
  const stacks = awsJson(['cloudformation', 'describe-stacks', '--stack-name', name]) as {
    Stacks: { StackStatus: string }[]
  }
  assert(stacks.Stacks[0].StackStatus.includes('COMPLETE'), `${name} is ${stacks.Stacks[0].StackStatus}`)
  console.log(`    ${name} ok`)
}

section('API routes declared in CDK')
const api = readFileSync(join(REPO_ROOT, 'infra/lib/stacks/api-stack.ts'), 'utf8')
for (const op of [
  'recordCollection',
  'recordDelivery',
  'recordReceipt',
  'getFateOfWaste',
  'listEwcCodes',
]) {
  assert(api.includes(op), `api-stack.ts should declare ${op}`)
}

console.log('Step 10 automated checks passed.')
console.log('Walk the journey manually (README). Treat prod as a checklist, not a deploy.')
