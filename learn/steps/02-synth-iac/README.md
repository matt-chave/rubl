# Step 02 — Synthesise IaC (still no AWS account)

## What is happening

**Infrastructure as Code (IaC)** means the AWS resources are TypeScript in [`infra/`](../../../infra/), not clicks in the console. `cdk synth` compiles that into **CloudFormation templates** in `cdk.out/`. Synth does not need credentials. You are reading a *plan* of the system.

Five stacks match five bounded contexts:

| Stack | Why it is separate |
|---|---|
| `DwtAuth` | Identity changes independently of waste law |
| `DwtLedger` | The legal write path |
| `DwtEvents` | Analytics lake — must not block ingestion |
| `DwtCharging` | Billing — isolated by a queue |
| `DwtApi` | HTTP edge |

## Why not one stack?

A billing outage must not take down `POST /movements`. Separate stacks (and later, a queue) make that failure domain visible in the diagram and in CloudFormation.

## Automated check

```bash
npm run learn -- 02
```

Runs `cdk synth` and asserts each stack template exists and mentions the expected service (Cognito, DynamoDB, EventBridge, SQS, API Gateway).

## Manual steps

1. `npx cdk synth` — wait for Lambda bundling (esbuild). Ignore feature-flag chatter.
2. Open `cdk.out/DwtLedger.template.json`. Search for `AWS::DynamoDB::Table`. That is the movements ledger.
3. Open [`infra/bin/app.ts`](../../../infra/bin/app.ts). Find `000000000000`. That dummy account exists **only** so synth works offline.
4. Open [`infra/lib/stacks/events-stack.ts`](../../../infra/lib/stacks/events-stack.ts) and read the comment on DynamoDB Streams vs `PutEvents`.

## Quiz

[`quiz.md`](quiz.md)

## Next

Step 02b: why these stacks exist and what “report a waste movement” includes. Then step 03 (validation).

## Save your work (GitHub)

From the **repo root** (`rubl/`). Why and what not to commit: [`learn/commit.md`](../../commit.md).

```bash
git status
git add -A
git status
git commit -m "learn: complete step 02 — synthesise IaC"
git push
```

`nothing to commit` is fine if you only read. `git push` needs `origin` from step 04b — skip it until then. Do not commit `.env`, keys, or tokens.
