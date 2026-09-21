import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assert, section } from '../../lib/assert'
import { REPO_ROOT } from '../../lib/progress'

function git(...args: string[]): string {
  const result = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' })
  assert(result.status === 0, (result.stderr || result.stdout || `git ${args.join(' ')} failed`).trim())
  return (result.stdout || '').trim()
}

section('Git is installed')
const version = spawnSync('git', ['--version'], { encoding: 'utf8' })
assert(version.status === 0, 'Install git from https://git-scm.com/ then re-run')
console.log(`    ${version.stdout.trim()}`)

section('This folder is a git repository')
assert(existsSync(join(REPO_ROOT, '.git')), 'At the repo root run: git init -b main')

section('At least one commit')
git('rev-parse', '--verify', 'HEAD')

section('.gitignore keeps dependencies and secrets out')
const ignore = readFileSync(join(REPO_ROOT, '.gitignore'), 'utf8')
assert(ignore.includes('node_modules'), '.gitignore must list node_modules')
assert(ignore.includes('.env'), '.gitignore must list .env')

section('Tracked files are not secrets or node_modules')
const tracked = git('ls-files').split('\n').filter(Boolean)
assert(
  !tracked.some((file) => file === '.env' || file.startsWith('.env.')),
  '.env is tracked — remove it from git before anyone clones',
)
assert(
  !tracked.some((file) => file === 'node_modules' || file.startsWith('node_modules/')),
  'node_modules is tracked — it must stay local',
)

section('Remote origin exists (GitHub or another clone host)')
const remotes = git('remote').split('\n').filter(Boolean)
assert(remotes.includes('origin'), 'Add the GitHub URL: git remote add origin <url>')
const origin = git('remote', 'get-url', 'origin')
assert(
  /github\.com|gitlab\.com|bitbucket\.org|cursor\.com|origin\.cursor\.com/i.test(origin),
  `origin should be a host others can clone (got ${origin})`,
)
console.log(`    origin = ${origin}`)
console.log('    Push is a manual step: git push -u origin main')

console.log('Step 04b automated checks passed.')
