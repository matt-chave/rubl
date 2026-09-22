# Step 04 — Local, mock, AWS dev, AWS prod

## What is happening

Same git repo, four **intents**. Mixing them (deploying "prod" into a sandbox, or expecting LocalStack to do Cognito + Pipes) is how people get lost.

Read [learn/environments.md](../../environments.md) and [learn/tools.md](../../tools.md) in full.

If you want **AWS `dev`** (steps 05–09), you must create the account and sign-in **yourself**. Cursor cannot open an Amazon account or create IAM users for you. The walkthrough is [learn/aws-dev-setup.md](../../aws-dev-setup.md) — what an account is, what an IAM user is, and what `aws configure` vs `aws configure sso` actually do.

| Intent | Steps | Cloud bill |
|---|---|---|
| `local` | 01–04b | None |
| `mock` | Optional DynamoDB/S3 practice | None (Docker) |
| `dev` | 05–09 | Sandbox AWS, destroyable stacks |
| `prod` | 10 checklist | Separate account, retain data |

## Why a second AWS account for prod?

Blast radius. A `cdk destroy` in the learning account must not delete the legal lake. Separate accounts are the cheapest isolation that still uses the same CDK.

## Automated check

```bash
npm run learn -- 04
```

Confirms the environment docs exist and `progress.json` has a valid `environment` field. It does **not** require AWS. Identity is a **manual** check (`aws sts get-caller-identity`).

## Manual steps

1. If you have not run step 02b yet (architecture), do that before 05: `npm run learn -- 02b`.
2. Decide: after 04, will you stop (local-only learning) or continue to AWS `dev`?
3. **If `dev`:** follow [aws-dev-setup.md](../../aws-dev-setup.md) end to end.
   - **You** create one sandbox AWS account.
   - **You** create one IAM user *or* use work SSO (not both).
   - **You** save a named profile `dwt-dev` on this laptop.
   - Cursor does **not** create those users. Step 05 CDK creates the Cognito *vendor* client — that is a different thing.
4. Prove the CLI (do not paste the JSON into git or chat):

   ```bash
   export AWS_PROFILE=dwt-dev
   aws sts get-caller-identity
   ```

   You should see an `Account` number. Then set `"environment": "dev"` in [`learn/progress.json`](../../progress.json).
5. If staying local: you can still read steps 05–10 as theory. The runner will fail 05 until credentials work — that is the gate. Step 04b (GitHub) still runs with no AWS.
6. Optional: `docker run --rm -p 4566:4566 localstack/localstack` and `aws --endpoint-url=http://localhost:4566 sts get-caller-identity` to feel a mock API. Know its limits (Pipes, Cognito M2M, Firehose + Glue lake).

## Quiz

[`quiz.md`](quiz.md)

## Next

Step 04b: put this folder on GitHub so others can clone it (still no AWS). Then step 05 deploys **only** `DwtAuth` — including `cdk bootstrap` the first time. If you have no account, stop after 04b and keep 01–04b as the local lab.

## Save your work (GitHub)

From the **repo root** (`rubl/`). Why and what not to commit: [`learn/commit.md`](../../commit.md).

```bash
git status
git add -A
git status
git commit -m "learn: complete step 04 — environments"
git push
```

`nothing to commit` is fine if you only read. `git push` needs `origin` from step 04b — skip it until then. Do not commit `.env`, keys, or tokens.
