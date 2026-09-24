#!/usr/bin/env npx tsx
/**
 * Tutorial runner. Work one step at a time (`npm run learn:status`,
 * `npm run learn -- 01`). A step cannot run until the previous step is
 * in learn/progress.json. AWS-backed steps fail with a clear message if
 * you have no credentials — that is intentional. Finish 01–04b locally first.
 *
 * Optional appendices (`npm run learn -- appendix-destroy-rebuild destroy`)
 * run a check without locking the numbered path or writing progress.json.
 */

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import {
  STEPS,
  APPENDICES,
  assertCanRun,
  markComplete,
  loadProgress,
  LEARN_ROOT,
  normalizeLearnId,
} from './lib/progress'

function printStatus(): void {
  const progress = loadProgress()
  console.log(`Environment: ${progress.environment}`)
  console.log(`Completed: ${progress.completed.join(', ') || '(none)'}\n`)
  for (const step of STEPS) {
    const done = progress.completed.includes(step.id) ? 'done' : 'open'
    const aws = step.needsAws ? ' [needs AWS]' : ' [local]'
    console.log(`  ${step.id}  ${done.padEnd(4)}  ${step.title}${aws}`)
  }
  console.log('\nOptional appendices (not gated; they do not write progress.json):\n')
  for (const appendix of APPENDICES) {
    const aws = appendix.needsAws ? ' [needs AWS]' : ' [local]'
    console.log(`  ${appendix.id}  ${appendix.title}${aws}`)
  }
  console.log('\nRead learn/README.md. Run a step with: npm run learn -- 01')
  console.log('Run an appendix check with: npm run learn -- appendix-destroy-rebuild destroy')
}

function runCheck(dir: string, extraArgs: string[]): number {
  const check = join(LEARN_ROOT, 'steps', dir, 'check.ts')
  const result = spawnSync(process.execPath, ['--import', 'tsx', check, ...extraArgs], {
    cwd: join(LEARN_ROOT, '..'),
    stdio: 'inherit',
  })
  return result.status ?? 1
}

function run(id: string, extraArgs: string[]): void {
  const appendix = APPENDICES.find((item) => item.id === id)
  if (appendix) {
    console.log(`\n=== Appendix: ${appendix.title} ===`)
    console.log(`Guide: learn/steps/${appendix.dir}/README.md\n`)
    const status = runCheck(appendix.dir, extraArgs)
    if (status !== 0) {
      process.exit(status)
    }
    console.log('\nAppendix check passed. learn/progress.json was not changed.')
    return
  }

  const step = STEPS.find((s) => s.id === id)
  if (!step) {
    const known = [...STEPS.map((s) => s.id), ...APPENDICES.map((a) => a.id)].join(', ')
    throw new Error(`Unknown step ${id}. Known: ${known}`)
  }
  assertCanRun(id)

  console.log(`\n=== Step ${step.id}: ${step.title} ===`)
  console.log(`Guide: learn/steps/${step.dir}/README.md`)
  console.log(`Quiz:  learn/steps/${step.dir}/quiz.md (answers in quiz-answers.md)\n`)

  const status = runCheck(step.dir, extraArgs)
  if (status !== 0) {
    process.exit(status)
  }

  markComplete(id)
  console.log(`\nStep ${id} passed and is marked complete.`)
  console.log('Do the quiz, then the next step. Ask questions — they go into learn/qa/index.md.')
}

const arg = process.argv[2]
if (!arg || arg === '--status' || arg === 'status') {
  printStatus()
} else {
  try {
    run(normalizeLearnId(arg), process.argv.slice(3))
  } catch (err) {
    console.error((err as Error).message)
    process.exit(1)
  }
}
