# Step 02b — Architecture and the scope of reporting a waste movement

## What is happening

Step 02 showed you **five CloudFormation stacks**. This step answers **why those stacks exist** and what “report a waste movement” includes — and what it deliberately leaves out.

Read [learn/architecture.md](../../architecture.md) in full. It is the map for the rest of the tutorial: domain journey, the AWS path of one POST, and a what/why for each component.

This is its own step, not part of 01 or 02. Synth taught you to *read a plan*. Architecture teaches you the *requirements the plan is serving* before you dive into validation (03) or deploy (05).

## Why this is still local

You are reading TypeScript and a markdown map. Nothing is created in AWS. That is the same reason `cdk synth` used account `000000000000`.

## Automated check

```bash
npm run learn -- 02b
```

Asserts the architecture note exists and names the journey stages, the five stacks, and the core AWS services.

## Manual steps

1. Open [learn/architecture.md](../../architecture.md). Write down the five journey stages (create → collect → deliver → receive → fate) in your own words.
2. Open the diagram in the repo [README](../../../README.md) (the Vendor → API Gateway → Lambda → DynamoDB → EventBridge tree). For **one** service, say out loud the *requirement* it satisfies (not the product name).
3. Open [`infra/lib/stacks/events-stack.ts`](../../../infra/lib/stacks/events-stack.ts) and read the comment on Streams vs `PutEvents`. That is the dual-write rule.
4. Open [`infra/lib/stacks/charging-stack.ts`](../../../infra/lib/stacks/charging-stack.ts). Confirm charging is a **subscriber**, not something `createMovement` calls.
5. List two things that are **out of scope** (for example spreadsheet upload, GOV.UK One Login, international TFS).

## Quiz

[`quiz.md`](quiz.md)

## Next

Step 03: how a JSON body becomes a valid movement (still local). You now know *why* validation sits in the Lambda and *why* `rules.ts` is a different layer from the lake.

## Save your work (GitHub)

From the **repo root** (`rubl/`). Why and what not to commit: [`learn/commit.md`](../../commit.md).

```bash
git status
git add -A
git status
git commit -m "learn: complete step 02b — architecture"
git push
```

`nothing to commit` is fine if you only read. `git push` needs `origin` from step 04b — skip it until then. Do not commit `.env`, keys, or tokens.
