import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assert, section } from '../../lib/assert'
import { REPO_ROOT } from '../../lib/progress'

const required = [
  'packages/dwt-govuk/src/Input.tsx',
  'packages/dwt-mfe-create-movement/src/elements.tsx',
  'packages/dwt-mfe-create-movement/src/ProducerForm.tsx',
  'packages/dwt-mfe-create-movement/src/CarriersForm.tsx',
  'packages/dwt-mfe-create-movement/src/WasteItemsForm.tsx',
  'packages/dwt-mfe-create-movement/src/ReviewSubmit.tsx',
  'packages/dwt-operator-client/src/queue.ts',
  'packages/dwt-operator-client/src/hooks.ts',
  'apps/dwt-bff/src/server.ts',
  'apps/dwt-operator-ui/src/App.tsx',
  'apps/dwt-widget-demo/src/main.tsx',
]

section('Workspace packages')
const rootPkg = readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')
assert(rootPkg.includes('"apps/*"'), 'root package.json should declare apps/* workspaces')
assert(rootPkg.includes('"packages/*"'), 'root package.json should declare packages/* workspaces')
for (const rel of required) {
  assert(existsSync(join(REPO_ROOT, rel)), `Missing ${rel}`)
}

section('Web Components and GOV.UK class names')
const elements = readFileSync(join(REPO_ROOT, 'packages/dwt-mfe-create-movement/src/elements.tsx'), 'utf8')
for (const tag of ['dwt-producer', 'dwt-carriers', 'dwt-waste-items', 'dwt-review-submit']) {
  assert(elements.includes(`'${tag}'`), `elements.tsx should define ${tag}`)
}
assert(elements.includes('dwt-change'), 'widgets should emit dwt-change')
assert(elements.includes('dwt-submit'), 'review widget should emit dwt-submit')
const input = readFileSync(join(REPO_ROOT, 'packages/dwt-govuk/src/Input.tsx'), 'utf8')
assert(input.includes('govuk-input'), 'GOV.UK wrappers should use govuk-input')
assert(input.includes('govuk-label'), 'GOV.UK wrappers should use govuk-label')
const bff = readFileSync(join(REPO_ROOT, 'apps/dwt-bff/src/server.ts'), 'utf8')
assert(bff.includes('CLIENT_SECRET'), 'BFF should hold the software client secret')
assert(bff.includes('x-api-key') || bff.includes('API_KEY'), 'BFF should forward the operator API key')

section('Step 11 reservation path still in the tree')
const api = readFileSync(join(REPO_ROOT, 'infra/lib/stacks/api-stack.ts'), 'utf8')
assert(api.includes('reserveIds'), 'api-stack.ts should still declare reserveIds')
const queue = readFileSync(join(REPO_ROOT, 'packages/dwt-operator-client/src/queue.ts'), 'utf8')
assert(queue.includes('movementId'), 'offline queue should attach a reserved movementId')
assert(queue.includes('isOnline'), 'queue should distinguish online and offline submit')

section('Widget and queue unit tests')
const test = spawnSync('npm', ['run', 'test:ui'], { cwd: REPO_ROOT, stdio: 'inherit', shell: true })
assert(test.status === 0, 'npm run test:ui failed')

console.log('Step 12 automated checks passed.')
console.log('Walk the GOV.UK shell (npm run bff && npm run ui) and the widget demo. Do not put secrets in the browser.')
