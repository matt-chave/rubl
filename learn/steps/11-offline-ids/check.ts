import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assert, section } from '../../lib/assert'
import { awsJson, requireAws } from '../../lib/aws'
import { REPO_ROOT } from '../../lib/progress'

requireAws()

section('Prior stacks still present')
for (const name of ['DwtAuth', 'DwtOnboarding', 'DwtLedger', 'DwtApi', 'DwtEvents', 'DwtCharging']) {
  const stacks = awsJson(['cloudformation', 'describe-stacks', '--stack-name', name]) as {
    Stacks: { StackStatus: string; Outputs?: { OutputKey: string }[] }[]
  }
  assert(stacks.Stacks[0].StackStatus.includes('COMPLETE'), `${name} is ${stacks.Stacks[0].StackStatus}`)
  console.log(`    ${name} ok`)
}

section('Reservations table output')
const ledger = awsJson(['cloudformation', 'describe-stacks', '--stack-name', 'DwtLedger']) as {
  Stacks: { Outputs?: { OutputKey: string }[] }[]
}
const ledgerKeys = (ledger.Stacks[0].Outputs ?? []).map((o) => o.OutputKey)
assert(ledgerKeys.includes('ReservationsTableName'), 'ReservationsTableName missing — deploy DwtLedger again')

section('CDK source')
const api = readFileSync(join(REPO_ROOT, 'infra/lib/stacks/api-stack.ts'), 'utf8')
assert(api.includes('reserveIds'), 'api-stack.ts should declare reserveIds')
assert(api.includes('dwt-operator-sandbox'), 'api-stack.ts should seed the sandbox operator API key')
const ledgerSrc = readFileSync(join(REPO_ROOT, 'infra/lib/stacks/ledger-stack.ts'), 'utf8')
assert(ledgerSrc.includes('IdReservations'), 'ledger-stack.ts should declare IdReservations')
assert(ledgerSrc.includes('timeToLiveAttribute'), 'IdReservations should enable TTL')

console.log('Step 11 automated checks passed.')
console.log('Walk reserve then claim in Bruno (see the README). Expiry deletes the reservation row; it does not recycle the public ID.')
