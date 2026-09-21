import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { assert, section } from '../../lib/assert'
import { REPO_ROOT } from '../../lib/progress'

section('Node.js version')
const major = Number(process.versions.node.split('.')[0])
assert(major >= 22, `Need Node 22+, found ${process.version}`)

section('Tutorial files')
for (const rel of ['learn/README.md', 'learn/tools.md', 'learn/qa/index.md', 'test/validation.test.ts']) {
  assert(existsSync(join(REPO_ROOT, rel)), `Missing ${rel}`)
}

section('Unit tests')
const test = spawnSync('npm', ['test'], { cwd: REPO_ROOT, stdio: 'inherit', shell: true })
assert(test.status === 0, 'npm test failed')

console.log('Step 01 automated checks passed.')
