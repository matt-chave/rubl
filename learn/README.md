# Learn Digital Waste Tracking

This folder is the **tutorial path**. The rest of the repo is the real system. Work **one numbered step at a time**. Do not deploy later stacks until the runner marks the earlier step complete.

You will practise:

- Software design (bounded contexts, OpenAPI as a contract, validation vs business rules)
- Architecture of reporting a waste movement ([architecture.md](architecture.md) — step 02b)
- Event-driven architecture (append-only ledger, fan-out, isolation of charging)
- AWS (CDK, Cognito, API Gateway, Lambda, DynamoDB, EventBridge, Kinesis, Firehose, S3, SQS)
- Cursor / AI (rules, Q&A library, asking *why* not only *what*)
- Git / GitHub (one codebase others can clone — step 04b)

## How a step works

1. Read `learn/steps/NN-*/README.md` — what is happening and why.
2. Install any tools listed for that step (see also [tools.md](tools.md)).
3. Run the automated check: `npm run learn -- NN`
4. Do the **manual** checks in the README so you can see the system, not just a green tick.
5. Take the quiz in `quiz.md`. Check yourself with `quiz-answers.md`.
6. Ask clarifying questions in chat. They are appended to [qa/index.md](qa/index.md) so you can revise later.

The runner **refuses** step N if step N−1 is not in [progress.json](progress.json).

```bash
npm run learn:status          # where you are
npm run learn -- 01           # run step 01 automated checks
```

## Can I do this outside AWS?

**Yes for steps 01–04b.** Those run on your laptop: Node tests, CDK `synth` (CloudFormation files, no account), reading code, and publishing the folder to GitHub.

**Partially for later steps.** A full mock of Cognito client-credentials, EventBridge Pipes, and Firehose Parquet conversion is not faithful enough to teach the real EDA path. See [environments.md](environments.md):

| Environment | What you can prove | Needs |
|---|---|---|
| `local` | Domain logic, validation, IaC synthesis, GitHub remote | Node 22 + git |
| `mock` | Optional LocalStack for DynamoDB/S3 *shapes* | Docker + LocalStack |
| `dev` | Real deploy of each stack, proving path | Sandbox account — [aws-dev-setup.md](aws-dev-setup.md) |
| `prod` | Same CDK, stricter retention, separate account | Second AWS account |

Steps 05–10 are written for **AWS `dev`**. Do not use a production account until step 10.

## Suggested pace

One step per sitting. Steps 01–04b can be done in a day. 05–09 each need a working AWS session and time for eventual consistency (Firehose buffers up to 60 seconds).
