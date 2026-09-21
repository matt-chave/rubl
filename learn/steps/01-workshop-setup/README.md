# Step 01 — Workshop setup (no AWS)

## What is happening

You prove the laptop can run this repo: Node 22, dependencies, and the **unit tests** that encode the domain (IDs, validation, HTTP errors). Nothing is created in AWS. That is deliberate. If we started with `cdk deploy`, you would be debugging IAM before you understood a Movement ID.

## Why this comes first

Software delivery is *evidence first*. A failing unit test is cheaper than a failing CloudFormation stack. Event-driven AWS is the later chapters; the legal journey (create → collect → deliver → receive) is already in TypeScript.

## Tools

See [learn/tools.md](../../tools.md) — Node 22 and npm only.

## Automated check

```bash
npm run learn -- 01
```

This asserts Node ≥ 22, runs `npm test`, and confirms the tutorial files exist.

## Manual steps (do these even if the check is green)

1. In a terminal at the repo root: `node -v` — you should see `v22` or higher.
2. `npm test` — eleven tests. Open [`test/validation.test.ts`](../../../test/validation.test.ts) and read one assertion. That is how we lock the OpenAPI error vocabulary (`NotProvided`).
3. Open [`src/lib/ids.ts`](../../../src/lib/ids.ts). Note the year prefix and sqids alphabet. Say out loud why callers must not parse the ID (the spec says the format is opaque).
4. Skim [`learn/qa/index.md`](../../qa/index.md). This is your revision notebook.

## Quiz

[`quiz.md`](quiz.md) — then [`quiz-answers.md`](quiz-answers.md).

## Next

Step 02: synthesise CloudFormation without an account.
