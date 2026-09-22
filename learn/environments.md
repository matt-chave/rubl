# Environments

The same codebase can run in four ways. Pick one **intent** and keep secrets out of git.

## 1. `local` — no AWS (steps 01–04b)

CDK compiles TypeScript into CloudFormation under `cdk.out/`. That is *design-time*. Nothing is created in a cloud account.

```bash
npm test
npx cdk synth
```

`infra/bin/app.ts` uses account `000000000000` when `CDK_DEFAULT_ACCOUNT` is unset so synth still works.

**Use this** to learn the domain, validation, and what CDK *would* create.

## 2. `mock` — LocalStack (optional)

[LocalStack](https://www.localstack.cloud/) pretends to be AWS on `localhost:4566`. It is useful to practise AWS CLI against DynamoDB and S3 **without a bill**.

It does **not** faithfully replace:

- Cognito OAuth2 *client credentials* + API Gateway Cognito authorizer
- EventBridge Pipes (DynamoDB stream → enrichment → bus)
- Firehose landing JSON to S3 and a Glue bronze→silver Parquet job

So LocalStack is a **sidecar for exploring tables and buckets**, not a substitute for steps 05–09.

```bash
# after installing Docker
docker run --rm -p 4566:4566 localstack/localstack
aws --endpoint-url=http://localhost:4566 dynamodb list-tables
```

If you use LocalStack, set `environment` in `learn/progress.json` to `"mock"` yourself. The automated checks for steps 05+ still target real AWS unless you change them.

## 3. `dev` — AWS sandbox (steps 05–09)

One personal or team **sandbox** account in **eu-west-2**. Stacks keep the `Dwt*` names. Tables and the lake bucket use `RemovalPolicy.DESTROY` so you can tear them down.

**How to get credentials:** [aws-dev-setup.md](aws-dev-setup.md). You create the account and the IAM user (or use work SSO). Cursor cannot do that. After `aws sts get-caller-identity` works with `AWS_PROFILE=dwt-dev`:

```bash
export AWS_PROFILE=dwt-dev
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=eu-west-2
npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/eu-west-2
```

Bootstrap is **step 05** (first deploy), not required to finish step 04.

Deploy **one stack per step**, not `--all`, so you can see each boundary.

## 4. `prod` — separate AWS account (step 10)

Do not share the sandbox account with production. In prod you would:

- Use a second account and a different AWS profile
- Change DynamoDB / S3 `RemovalPolicy` to `RETAIN`
- Turn off `autoDeleteObjects` on the lake bucket
- Keep Cognito and API keys in Secrets Manager / a password manager
- Restrict who can `cdk deploy`

This tutorial does **not** auto-deploy prod. Step 10 is a checklist, not a push-button.

## Region

Default is **eu-west-2** (London) — UK public sector default. Override only if you know why.
