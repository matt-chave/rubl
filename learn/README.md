# Learn Digital Waste Tracking

This folder is the **tutorial path**. The rest of the repo is the real system. Work **one numbered step at a time**. Do not deploy later stacks until the runner marks the earlier step complete.

You will practise software design (bounded contexts, OpenAPI as a contract, validation versus business rules), the architecture of reporting a waste movement ([architecture.md](architecture.md) — step 02b), event-driven architecture (an append-only ledger, fan-out, isolation of charging), AWS (CDK, Cognito, API Gateway, Lambda, DynamoDB, EventBridge, Kinesis, Firehose, S3, SQS), onboarding micro-frontends (`dwt-software-provider-signup` in step 05, `dwt-operator-signup` in step 05b), Cursor and AI (rules, the Q&A library, asking *why* not only *what*), and Git / GitHub (one codebase others can clone — step 04b).

## How a step works

1. Read `learn/steps/NN-*/README.md` — what is happening and why.
2. Install any tools listed for that step (see also [tools.md](tools.md)).
3. Do the **manual** steps in that README (including any `cdk deploy` / bootstrap). From step 05, learner-facing HTTP is **[Bruno](bruno.md)** first; curl is the labelled alternative. Do not use Bruno for `cdk deploy` or AWS CLI / console looks.
4. Run the automated check last: `npm run learn -- NN`. That is the green tick, not the deploy.
5. Take the quiz in `quiz.md`. Check yourself with `quiz-answers.md`.
6. Save the sitting: each README ends with **Save your work (GitHub)**. Notes: [commit.md](commit.md).
7. Ask clarifying questions in chat. They are appended to [qa/index.md](qa/index.md) so you can revise later.

The runner **refuses** step N if step N−1 is not in [progress.json](progress.json). Step 12 is locked until step 11 is complete.

```bash
npm run learn:status          # where you are
npm run learn -- 01           # run step 01 automated checks
```

## Optional appendix

The numbered path is 01–12. If you need to tear the sandbox down and stand it up again, use [appendix — destroy and rebuild](steps/appendix-destroy-rebuild/README.md). It is not a gated step: you can run its checks without finishing step 10 or 11, and a failed appendix check does not mark the tutorial incomplete or write [progress.json](progress.json).

```bash
npm run learn -- appendix-destroy-rebuild destroy
npm run learn -- appendix-destroy-rebuild rebuild
```

## Can I do this outside AWS?

**Yes for steps 01–04b.** Those run on your laptop: Node tests, CDK `synth` (CloudFormation files, no account), reading code, and publishing the folder to GitHub.

**Partially for later steps.** A full mock of Cognito client-credentials, EventBridge Pipes, Firehose bronze JSON, and Glue silver Parquet is not faithful enough to teach the real EDA path. See [environments.md](environments.md):

| Environment | What you can prove | Needs |
|---|---|---|
| `local` | Domain logic, validation, IaC synthesis, GitHub remote | Node 22 + git |
| `mock` | Optional LocalStack for DynamoDB/S3 *shapes* | Docker + LocalStack |
| `dev` | Real deploy of each stack, proving path | Sandbox account — [aws-dev-setup.md](aws-dev-setup.md) |
| `prod` | Same CDK, stricter retention, separate account | Second AWS account |

Steps 05–11 are written for **AWS `dev`**. Step 05 also introduces the onboarding host (`npm run onboarding-ui` with `npm run bff`). Step 12 is local UI for create-movement (a BFF talks to the API you already deployed). Do not use a production account until step 10.

## Suggested pace

One step per sitting. Steps 01–04b can be done in a day. 05 and 05b introduce Cognito plus the two onboarding forms; 06–09 each need a working AWS session and time for eventual consistency (Firehose buffers up to 60 seconds).
