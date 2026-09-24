# Appendix — Destroy and rebuild the AWS sandbox

## What is happening

This is an optional walkthrough, not the next numbered lesson. You can read it from any point on the path, including before step 10 is marked complete, and a failed check here does **not** write [learn/progress.json](../../progress.json) or lock step 11.

The reason to tear the sandbox down and stand it up again is usually a messy account: a rolled-back stack, leftover exports, or credentials that no longer match what Bruno holds. You delete only the five `Dwt*` CloudFormation stacks, then deploy them again in the same order as lessons 05–09. You keep the AWS account, the [IAM](https://console.aws.amazon.com/iam/home#/users) ([IAM users](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html)) or [IAM Identity Center](https://eu-west-2.console.aws.amazon.com/singlesignon/home?region=eu-west-2#/instances) ([what Identity Center is](https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html)) login, the laptop profile `dwt-dev`, and the [CDK bootstrap](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html) stack (`CDKToolkit`). You do not wipe the account.

Do this only in the **sandbox**. Do not run it against a production account. Do not paste access keys, client secrets, API keys, tokens, account numbers, or `sts get-caller-identity` JSON into chat.

The CLI path below is the primary path, the same way Bruno is the primary HTTP path in later lessons. The [CloudFormation console](#alternative-cloudformation-console) is the labelled alternative.

## Confirm you are in the sandbox

From the **repo root** (`rubl/`), in a new terminal:

```bash
export AWS_PROFILE=dwt-dev
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=eu-west-2
```

If the session has expired (Path B / SSO in [aws-dev-setup.md](../../aws-dev-setup.md)), run `aws sso login --profile dwt-dev` and then the same three exports. `aws sts get-caller-identity` should mention the sandbox identity you already know (for example `dwt-dev-admin`). If the ARN looks like a work production role, **stop**.

Those `export` lines print nothing. That is success. Do not paste the `sts` JSON into chat.

Watch the work in [CloudFormation stacks](https://eu-west-2.console.aws.amazon.com/cloudformation/home?region=eu-west-2#/stacks) ([delete a stack](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-console-delete-stack.html), [create a stack](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-console-create-stack.html)). Region must be **London (eu-west-2)**.

## Automated path (CLI)

[`infra/bin/app.ts`](../../../infra/bin/app.ts) wires dependents onto exporters: `DwtOnboarding` needs Auth, `DwtApi` needs Auth, Onboarding, and Ledger, `DwtEvents` needs Ledger, `DwtCharging` needs Events. Destroy **dependents first**, or CloudFormation exports block the delete.

### 1. Destroy the `Dwt*` stacks

```bash
npx cdk destroy DwtApi DwtCharging DwtEvents DwtLedger DwtOnboarding DwtAuth
```

Confirm when CDK asks. You do not need to empty [Kinesis](https://eu-west-2.console.aws.amazon.com/kinesis/home?region=eu-west-2#/streams/list) ([streams](https://docs.aws.amazon.com/streams/latest/dev/introduction.html)) first; the stream goes with `DwtEvents`. Leave `CDKToolkit` alone. After a successful destroy you should still see that bootstrap stack; you do not re-run `cdk bootstrap` unless you deleted it or changed account or region.

This check never runs `cdk destroy` for you. When the stacks are gone:

```bash
npm run learn -- appendix-destroy-rebuild destroy
```

### 2. Lake bucket and other leftovers

The lake bucket is versioned and uses `RemovalPolicy.DESTROY` plus `autoDeleteObjects`, so CDK should empty [S3](https://eu-west-2.console.aws.amazon.com/s3/home?region=eu-west-2) ([empty a versioned bucket](https://docs.aws.amazon.com/AmazonS3/latest/userguide/empty-bucket.html)) as part of destroy. If `DwtEvents` fails because the bucket is not empty, empty **current objects and previous versions** in the console, then run the same `cdk destroy` again for the stacks that remain.

Glance at billed leftovers after destroy: the lake bucket if it survived, leftover Kinesis streams, and [CloudWatch log groups](https://eu-west-2.console.aws.amazon.com/cloudwatch/home?region=eu-west-2#logsV2:log-groups) ([log groups](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/Working-with-log-groups-and-streams.html)). Billing is a [global console](https://console.aws.amazon.com/billing/home#/) ([Billing and Cost Management](https://docs.aws.amazon.com/cost-management/latest/userguide/what-is-cost-management.html)). Sandbox tables and the lake are meant to be destroyable; production would use `RemovalPolicy.RETAIN` and would not auto-delete S3.

### 3. Recreate one stack per lesson

Deploy **one stack per lesson**, not `--all`. The order is Auth → Onboarding → Ledger → Api → Events → Charging (`DwtApi` is step 07 and needs Auth, Onboarding, and Ledger; it does not wait for the lake). Same profile and `CDK_DEFAULT_*` exports as above. Type `y` when CDK asks about IAM.

```bash
npx cdk deploy DwtAuth
npx cdk deploy DwtOnboarding
npx cdk deploy DwtLedger
npx cdk deploy DwtApi
npx cdk deploy DwtEvents
npx cdk deploy DwtCharging
```

After all are `CREATE_COMPLETE` or `UPDATE_COMPLETE`:

```bash
npm run learn -- appendix-destroy-rebuild rebuild
```

If you have only destroyed so far, that rebuild check fails on purpose and tells you which stack to deploy next.

### 4. Refresh Bruno (or curl) credentials

Every Cognito client and the operator API key are **new** after this. Copy the new values into Bruno collection `dwt-sandbox`, environment `dev` — not into chat. Tick **Secret** for `clientSecret` and `apiKey` if Bruno offers it. Clear the old `token`, `movementId`, and `deliveryId`. Then run **Get token** so `token` is a fresh JWT.

**`tokenUrl`** and **`clientId`** from CloudFormation → `DwtAuth` → **Outputs**, or:

```bash
aws cloudformation describe-stacks --stack-name DwtAuth \
  --query "Stacks[0].Outputs[?OutputKey=='TokenUrl'].OutputValue" --output text
aws cloudformation describe-stacks --stack-name DwtAuth \
  --query "Stacks[0].Outputs[?OutputKey=='ClientId'].OutputValue" --output text
```

**`clientSecret`** is not a stack output. Open [Cognito → User pools](https://eu-west-2.console.aws.amazon.com/cognito/v2/idp/user-pools?region=eu-west-2) ([app clients](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-client-apps.html)) → `dwt-vendor-m2m` → `dwt-vendor-software` → **Show** / **View client secret**, or:

```bash
POOL=$(aws cloudformation describe-stacks --stack-name DwtAuth \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
CLIENT=$(aws cloudformation describe-stacks --stack-name DwtAuth \
  --query "Stacks[0].Outputs[?OutputKey=='ClientId'].OutputValue" --output text)
aws cognito-idp describe-user-pool-client --user-pool-id "$POOL" --client-id "$CLIENT" \
  --query 'UserPoolClient.ClientSecret' --output text
```

**`apiBase`** and the operator **`apiKey`** (`dwt-operator-sandbox`, ARN `ApiKeySecretArn`) after `DwtApi` is up:

```bash
aws cloudformation describe-stacks --stack-name DwtApi \
  --query "Stacks[0].Outputs[?OutputKey=='ApiBaseUrl'].OutputValue" --output text
aws cloudformation describe-stacks --stack-name DwtApi \
  --query "Stacks[0].Outputs[?OutputKey=='ApiKeySecretArn'].OutputValue" --output text
aws secretsmanager get-secret-value --secret-id "<ARN>" --query SecretString --output text
```

Same secret in [Secrets Manager](https://eu-west-2.console.aws.amazon.com/secretsmanager/listsecrets?region=eu-west-2) ([retrieve a secret](https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets.html)); same key in [API keys](https://eu-west-2.console.aws.amazon.com/apigateway/main/api-keys?region=eu-west-2) ([usage plans](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-key-usage-plans.html)). `apiBase` must end `/prod/dwt`. The stack also outputs `SandboxOperatorId` (`OP-SANDBOX-1`); you do not paste that into Bruno.

Do not reset `learn/progress.json`. The next HTTP call should use the new software client and the new operator key.

## Alternative: CloudFormation console

Same teardown and rebuild, no `cdk destroy` if you prefer the browser. Skip this section if you already finished the CLI path. You still need the CLI (or CDK) to recreate stacks unless you upload templates by hand — the usual console path is **delete in the console, then `cdk deploy` one stack at a time**.

### Delete the stacks

1. Open [CloudFormation stacks](https://eu-west-2.console.aws.amazon.com/cloudformation/home?region=eu-west-2#/stacks) in **eu-west-2**. Confirm the account name in the top-right is the sandbox. If it looks like production, stop.
2. Delete **dependents first**, one at a time: `DwtApi`, then `DwtCharging`, then `DwtEvents`, then `DwtLedger`, then `DwtOnboarding`, then `DwtAuth`. Use **Delete** on each stack ([delete a stack](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-console-delete-stack.html)). Wait until the stack disappears (or shows `DELETE_COMPLETE` in history) before deleting the next exporter it depended on.
3. Do **not** delete `CDKToolkit`.
4. If `DwtEvents` sticks on a versioned lake bucket, open [S3](https://eu-west-2.console.aws.amazon.com/s3/home?region=eu-west-2), empty **current objects and previous versions** ([empty a versioned bucket](https://docs.aws.amazon.com/AmazonS3/latest/userguide/empty-bucket.html)), then retry the delete.

Then run the destroy check:

```bash
export AWS_PROFILE=dwt-dev
npm run learn -- appendix-destroy-rebuild destroy
```

### Recreate the stacks

Creating five CDK stacks from the console **Create stack** wizard ([create a stack](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-console-create-stack.html)) means uploading synthesised templates and filling parameters by hand. The reliable alternative is to stay on this profile and run the same five `npx cdk deploy` commands as in the CLI path, watching progress on the CloudFormation page.

After `DwtAuth` and `DwtApi` are up, copy credentials from the consoles if you would rather not use `describe-stacks`:

- [Cognito → User pools](https://eu-west-2.console.aws.amazon.com/cognito/v2/idp/user-pools?region=eu-west-2) → `dwt-vendor-m2m` → `dwt-vendor-software` → **Show** client secret ([app clients](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-client-apps.html)). `tokenUrl` and `clientId` are also on `DwtAuth` **Outputs**.
- [Secrets Manager](https://eu-west-2.console.aws.amazon.com/secretsmanager/listsecrets?region=eu-west-2) → the secret named by `ApiKeySecretArn` ([retrieve a secret](https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets.html)). That string is the operator `apiKey`.
- [API keys](https://eu-west-2.console.aws.amazon.com/apigateway/main/api-keys?region=eu-west-2) shows the same `dwt-operator-sandbox` key ([usage plans](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-key-usage-plans.html)).

Then the rebuild check:

```bash
npm run learn -- appendix-destroy-rebuild rebuild
```

## Automated check

The check only **reads** CloudFormation. It does not destroy or deploy. A missing `AWS_PROFILE` is a failure, not a pass. It pins the lookup to **eu-west-2**.

```bash
export AWS_PROFILE=dwt-dev
npm run learn -- appendix-destroy-rebuild destroy    # five Dwt* stacks gone
npm run learn -- appendix-destroy-rebuild rebuild    # five stacks healthy, Auth + Api outputs
```

You can also invoke the runner directly: `npx tsx learn/run-step.ts appendix-destroy-rebuild destroy`. Either form leaves `learn/progress.json` alone, including when the check fails.

Without `destroy` or `rebuild`, the check prints the current status of each stack and exits non-zero so an empty run cannot look like success.

## What you do not delete

Leave the AWS account, the IAM or Identity Center user, the `dwt-dev` profile, `CDKToolkit`, and `learn/progress.json`. Closing the account or deleting the human login is a different job and is not part of this tutorial.

## See also

The same sequence was first agreed in [Q&A — How do we delete and recreate the AWS environment](../../qa/index.md#2026-09-23--how-do-we-delete-and-recreate-the-aws-environment). [Step 10](../10-remaining-and-prod/README.md) points here so the teardown paragraph and this appendix do not drift. Sandbox versus prod: [environments.md](../../environments.md).
