import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { assert, section } from '../../lib/assert'
import { REPO_ROOT } from '../../lib/progress'

const modules = [
  'src/lib/validation/index.ts',
  'src/lib/validation/primitives.ts',
  'src/lib/validation/weight.ts',
  'src/lib/validation/parties.ts',
  'src/lib/validation/waste-item.ts',
  'src/lib/validation/operations/movements.ts',
  'src/lib/validation/operations/collections.ts',
  'src/lib/validation/operations/deliveries.ts',
  'src/lib/validation/operations/receipts.ts',
  'src/lib/rules.ts',
  'openapi/openapi.yaml',
  'openapi/event-model/schema/common/producer/producer.schema.json',
  'openapi/event-model/schema/common/producer/producer-base.schema.json',
  'openapi/event-model/schema/common/producer/producer-household.schema.json',
  'openapi/event-model/schema/common/producer/producer-commercial.schema.json',
  'openapi/event-model/schema/common/producer/producer-municipal.schema.json',
]

section('Validation modules')
for (const rel of modules) {
  assert(existsSync(join(REPO_ROOT, rel)), `Missing ${rel}`)
}

section('Domain unit tests')
const test = spawnSync('npm', ['test'], { cwd: REPO_ROOT, stdio: 'inherit', shell: true })
assert(test.status === 0, 'npm test failed')

console.log('Step 03 automated checks passed.')
