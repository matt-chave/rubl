import { spawnSync } from 'node:child_process'

export function awsIdentity(): { account: string; arn: string } | undefined {
  const result = spawnSync(
    'aws',
    ['sts', 'get-caller-identity', '--output', 'json'],
    { encoding: 'utf8' },
  )
  if (result.status !== 0) {
    return undefined
  }
  const parsed = JSON.parse(result.stdout) as { Account: string; Arn: string }
  return { account: parsed.Account, arn: parsed.Arn }
}

export function requireAws(): { account: string; arn: string } {
  const id = awsIdentity()
  if (!id) {
    throw new Error(
      [
        'This step needs a real AWS account (environment: dev).',
        'Finish steps 01–04b locally first.',
        'Then: install AWS CLI v2, run `aws configure sso` (or a named profile),',
        'export AWS_PROFILE=..., and confirm with `aws sts get-caller-identity`.',
        'Do not paste access keys into Cursor.',
        'See learn/environments.md and learn/tools.md.',
      ].join('\n'),
    )
  }
  return id
}

export function awsJson(args: string[]): unknown {
  const result = spawnSync('aws', [...args, '--output', 'json'], { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(result.stderr || `aws ${args.join(' ')} failed`)
  }
  return JSON.parse(result.stdout || 'null')
}
