#!/usr/bin/env npx tsx
/**
 * Tutorial runner. One step at a time.
 *
 *   npm run learn:status
 *   npm run learn -- 01
 *
 * A step cannot run until the previous step is in learn/progress.json.
 * AWS-backed steps fail with a clear message if you have no credentials —
 * that is intentional. Finish 01–04b locally first.
 */

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { STEPS, assertCanRun, markComplete, loadProgress, LEARN_ROOT } from './lib/progress'

function printStatus(): void {
  const progress = loadProgress()
  console.log(`Environment: ${progress.environment}`)
  console.log(`Completed: ${progress.completed.join(', ') || '(none)'}\n`)
  for (const step of STEPS) {
    const done = progress.completed.includes(step.id) ? 'done' : 'open'
    const aws = step.needsAws ? ' [needs AWS]' : ' [local]'
    console.log(`  ${step.id}  ${done.padEnd(4)}  ${step.title}${aws}`)
  }
  console.log('\nRead learn/README.md. Run a step with: npm run learn -- 01')
}

function run(id: string): void {
  const step = STEPS.find((s) => s.id === id)
  if (!step) {
    throw new Error(`Unknown step ${id}. Known: ${STEPS.map((s) => s.id).join(', ')}`)
  }
  assertCanRun(id)

  console.log(`\n=== Step ${step.id}: ${step.title} ===`)
  console.log(`Guide: learn/steps/${step.dir}/README.md`)
  console.log(`Quiz:  learn/steps/${step.dir}/quiz.md (answers in quiz-answers.md)\n`)

  const check = join(LEARN_ROOT, 'steps', step.dir, 'check.ts')
  const result = spawnSync(process.execPath, ['--import', 'tsx', check], {
    cwd: join(LEARN_ROOT, '..'),
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
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
    run(arg.replace(/^step-?/i, '').padStart(2, '0'))
  } catch (err) {
    console.error((err as Error).message)
    process.exit(1)
  }
}
