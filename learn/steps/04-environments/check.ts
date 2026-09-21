import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assert, section } from '../../lib/assert'
import { loadProgress, REPO_ROOT } from '../../lib/progress'

section('Environment docs')
for (const rel of ['learn/environments.md', 'learn/tools.md', 'learn/aws-dev-setup.md']) {
  assert(existsSync(join(REPO_ROOT, rel)), `Missing ${rel}`)
}

section('progress.environment')
const progress = loadProgress()
const allowed = ['local', 'mock', 'dev', 'prod']
assert(allowed.includes(progress.environment), `environment must be one of ${allowed.join(', ')}`)
console.log(`    current environment = ${progress.environment}`)

const envDoc = readFileSync(join(REPO_ROOT, 'learn/environments.md'), 'utf8')
assert(envDoc.includes('local'), 'environments.md must describe local')
assert(envDoc.includes('LocalStack'), 'environments.md must describe mock/LocalStack')
assert(envDoc.includes('eu-west-2'), 'environments.md must state the default region')

const setupDoc = readFileSync(join(REPO_ROOT, 'learn/aws-dev-setup.md'), 'utf8')
assert(setupDoc.includes('aws configure --profile dwt-dev'), 'aws-dev-setup.md must show Path A (IAM user)')
assert(setupDoc.includes('aws configure sso'), 'aws-dev-setup.md must show Path B (SSO)')
assert(setupDoc.includes('named profile'), 'aws-dev-setup.md must explain a named profile')

console.log('Step 04 automated checks passed.')
console.log('If you will deploy, confirm `aws sts get-caller-identity` in another terminal before step 05.')
