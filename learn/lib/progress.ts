import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface Progress {
  completed: string[]
  environment: 'local' | 'mock' | 'dev' | 'prod'
  updatedAt: string | null
}

export const LEARN_ROOT = join(__dirname, '..')
export const REPO_ROOT = join(LEARN_ROOT, '..')
const PROGRESS_PATH = join(LEARN_ROOT, 'progress.json')

export const STEPS = [
  { id: '01', dir: '01-workshop-setup', title: 'Workshop setup (no AWS)', needsAws: false },
  { id: '02', dir: '02-synth-iac', title: 'Synthesise IaC and read the templates', needsAws: false },
  { id: '02b', dir: '02b-architecture', title: 'Architecture and the scope of reporting a waste movement', needsAws: false },
  { id: '03', dir: '03-domain-and-validation', title: 'Domain model and payload validation', needsAws: false },
  { id: '04', dir: '04-environments', title: 'Local, mock, AWS dev, AWS prod', needsAws: false },
  { id: '04b', dir: '04b-share-the-repo', title: 'Put the project on GitHub so others can clone it', needsAws: false },
  { id: '05', dir: '05-auth-stack', title: 'Deploy Cognito and get a token', needsAws: true },
  { id: '05b', dir: '05b-operator-onboarding', title: 'Waste operator self sign-up', needsAws: true },
  { id: '06', dir: '06-ledger-stack', title: 'Deploy the movements ledger', needsAws: true },
  { id: '07', dir: '07-api-proving-path', title: 'API + POST /movements proving path', needsAws: true },
  { id: '08', dir: '08-events-lake', title: 'Event bus, Kinesis, bronze / silver lake', needsAws: true },
  { id: '09', dir: '09-charging', title: 'Charging queue and operator ledger', needsAws: true },
  { id: '10', dir: '10-remaining-and-prod', title: 'Remaining endpoints and prod promotion', needsAws: true },
  { id: '11', dir: '11-offline-ids', title: 'Reserve public IDs for offline clients', needsAws: true },
  { id: '12', dir: '12-create-movement-mfe', title: 'Create-movement micro frontends', needsAws: false },
] as const

export type StepId = (typeof STEPS)[number]['id']

/** Optional walkthroughs. They are not in the gated 01–12 sequence and never write progress.json. */
export const APPENDICES = [
  {
    id: 'appendix-destroy-rebuild',
    dir: 'appendix-destroy-rebuild',
    title: 'Destroy and rebuild the AWS sandbox',
    needsAws: true,
  },
] as const

export type AppendixId = (typeof APPENDICES)[number]['id']

export function isAppendixId(id: string): boolean {
  return APPENDICES.some((appendix) => appendix.id === id)
}

export function normalizeLearnId(raw: string): string {
  const stripped = raw.replace(/^step-?/i, '')
  if (stripped.startsWith('appendix')) {
    return stripped
  }
  return stripped.padStart(2, '0')
}

export function loadProgress(): Progress {
  return JSON.parse(readFileSync(PROGRESS_PATH, 'utf8')) as Progress
}

export function saveProgress(progress: Progress): void {
  progress.updatedAt = new Date().toISOString()
  writeFileSync(PROGRESS_PATH, `${JSON.stringify(progress, null, 2)}\n`)
}

export function previousStepId(id: string): string | undefined {
  const index = STEPS.findIndex((s) => s.id === id)
  return index > 0 ? STEPS[index - 1].id : undefined
}

export function assertCanRun(id: string): void {
  if (isAppendixId(id)) {
    return
  }
  const prev = previousStepId(id)
  if (!prev) {
    return
  }
  const progress = loadProgress()
  if (!progress.completed.includes(prev)) {
    throw new Error(
      `Step ${id} is locked. Complete step ${prev} first:\n  npm run learn -- ${prev}`,
    )
  }
}

export function markComplete(id: string): void {
  if (isAppendixId(id)) {
    return
  }
  const progress = loadProgress()
  if (!progress.completed.includes(id)) {
    progress.completed.push(id)
    saveProgress(progress)
  }
}
