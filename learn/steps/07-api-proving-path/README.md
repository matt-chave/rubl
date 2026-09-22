# Step 07 — API + POST /movements (proving path)

## What is happening

This is the first **end-to-end write** a vendor will do:

1. JWT from Cognito (step 05)
2. `x-api-key` from Secrets Manager (stack output `ApiKeySecretArn`)
3. `POST /dwt/movements` with [`learn/fixtures/create-movement.json`](../../fixtures/create-movement.json)
4. Lambda validates, mints a sqid, `PutItem` EVENT + CURRENT
5. 201 `{ movementId, validation: { warnings } }`

Lake and charging are **not** required for this HTTP success. That is the point of EDA: ingestion is complete when DynamoDB has the event.

## Where the code is

The CloudFormation stack `DwtApi` is [`infra/lib/stacks/api-stack.ts`](../../../infra/lib/stacks/api-stack.ts) (wired as `new ApiStack(app, 'DwtApi', …)` in [`infra/bin/app.ts`](../../../infra/bin/app.ts)). **Read that file before you deploy** — the comments are the explanation. CDK creates:

- API Gateway **REST** (v1) named `digital-waste-tracking` — not HTTP API, because usage plans need REST
- Cognito JWT authorizer on the pool from `DwtAuth` (checks the token locally; Lambdas do not call Cognito)
- One sandbox **API key** + usage plan (`x-api-key`) — not the Cognito client secret
- Path prefix `/dwt` to match OpenAPI
- One Lambda per OpenAPI `operationId` ([`infra/lib/constructs/dwt-lambda.ts`](../../../infra/lib/constructs/dwt-lambda.ts) → [`src/lambdas/<id>/`](../../../src/lambdas/))

Do **not** click **Create API** in [API Gateway](https://eu-west-2.console.aws.amazon.com/apigateway/main/apis?region=eu-west-2) first. This stack does not create tables or the User Pool. Stage name `prod` is the Gateway stage, not the AWS prod account.

## Why this stack alone

If the edge is wrong (401/403), you never know whether validation or DynamoDB failed. Prove `POST /dwt/movements` → 201 and two ledger rows before the lake exists.

## Manual steps (this is the important one)

Same order as 05/06: **read, deploy, look, then the check**. `DwtApi` needs Auth + Ledger already deployed.

1. Open [`infra/lib/stacks/api-stack.ts`](../../../infra/lib/stacks/api-stack.ts) and walk REST → authorizer → API key → `/dwt` → `ROUTES`. There is no `PutEvents`.
2. Reuse the same profile as step 05 if this is a new terminal, then deploy (this can take a few minutes — many Lambdas). CDK will ask about **IAM** (Lambda roles, DynamoDB access). That is expected — type **`y`**. It is not the failure.

```bash
export AWS_PROFILE=dwt-dev
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=eu-west-2
npx cdk deploy DwtApi
```

If a previous attempt rolled back, wait until `aws cloudformation describe-stacks --stack-name DwtApi` shows `ROLLBACK_COMPLETE` or the stack is gone, then deploy again.


3. Collect outputs — **fill this terminal** with the four values the later `curl` needs. CDK wrote them as CloudFormation **outputs** when the stacks deployed (`CfnOutput` in `api-stack.ts` / `auth-stack.ts`). You are not creating anything new; you are **reading** those labels so you do not type hashed API ids by hand.

   | Variable | From | What it is |
   |---|---|---|
   | `API_BASE` | `DwtApi` output `ApiBaseUrl` | HTTPS prefix including `/dwt` — the vendor API, not Cognito |
   | `SECRET_ARN` | `DwtApi` output `ApiKeySecretArn` | Pointer to the secret; **not** the API key itself |
   | `API_KEY` | [Secrets Manager](https://eu-west-2.console.aws.amazon.com/secretsmanager/listsecrets?region=eu-west-2) via that ARN | The `x-api-key` header (usage plan). Not the Cognito client secret |
   | `TOKEN_URL` | `DwtAuth` output `TokenUrl` | Cognito `/oauth2/token` so you can mint a JWT again in this shell |

   Same terminal as step 2 (profile still set). The four `$(…)` lines are **silent on success** — AWS stdout is captured into the variable, so a blank terminal is expected until the `echo`. That `echo` should print `API_BASE set: yes` (not the API key). Optional: `echo "$API_BASE"` should look like `https://….execute-api.eu-west-2.amazonaws.com/prod/dwt`. Do not paste `API_KEY` into chat.

```bash
API_BASE=$(aws cloudformation describe-stacks --stack-name DwtApi \
  --query "Stacks[0].Outputs[?OutputKey=='ApiBaseUrl'].OutputValue" --output text)
SECRET_ARN=$(aws cloudformation describe-stacks --stack-name DwtApi \
  --query "Stacks[0].Outputs[?OutputKey=='ApiKeySecretArn'].OutputValue" --output text)
API_KEY=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" --query SecretString --output text)
TOKEN_URL=$(aws cloudformation describe-stacks --stack-name DwtAuth \
  --query "Stacks[0].Outputs[?OutputKey=='TokenUrl'].OutputValue" --output text)
echo "API_BASE set: $([ -n "$API_BASE" ] && echo yes || echo NO)"
```

4. Get a JWT (`TOKEN`) in **this** terminal — same as lesson 05, repeated here. `TOKEN_URL` is already set from step 3. You still need the Cognito app client (not the API key). `CLIENT_ID` is stack output `ClientId`; `CLIENT_SECRET` is from the [app client](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-client-apps.html) (Show secret) or:

```bash
export CLIENT_ID=$(aws cloudformation describe-stacks --stack-name DwtAuth \
  --query "Stacks[0].Outputs[?OutputKey=='ClientId'].OutputValue" --output text)
POOL=$(aws cloudformation describe-stacks --stack-name DwtAuth \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
export CLIENT_SECRET=$(aws cognito-idp describe-user-pool-client \
  --user-pool-id "$POOL" --client-id "$CLIENT_ID" \
  --query 'UserPoolClient.ClientSecret' --output text)

TOKEN=$(curl -sS -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d grant_type=client_credentials \
  -d scope=dwt/movements \
  "$TOKEN_URL" | jq -r .access_token)
echo "TOKEN set: $([ -n "$TOKEN" ] && echo yes || echo NO)"
```

The `jq -r .access_token` keeps **only** the JWT (`eyJ…`) for `Authorization: Bearer`. Lesson 05 stored the whole JSON in `TOKEN`; here you need the inner field. The `echo` should print `TOKEN set: yes`. Do not paste the token into chat. This still does **not** call `/movements`.


5. **Happy path**

```bash
curl -sS -D - -X POST "$API_BASE/movements" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  --data-binary @learn/fixtures/create-movement.json
```

Expect `201` and a `movementId`. Copy it.

If you get **401** `{"message":"Unauthorized"}` (not 403): that is the JWT authorizer, not the API key. Confirm `echo "${TOKEN:0:3}"` prints `eyJ` (if it prints `nul`, `jq` did not find `access_token` — re-run the token curl without `| jq`). Then **redeploy** `DwtApi` so methods include `authorizationScopes: ['dwt/movements']`. Without that scope list, API Gateway expects a Cognito **ID** token; client credentials issue an **access** token, so 401 is expected until the stack is updated. Answer `y` if CDK asks about IAM. Re-collect `TOKEN` if it is older than `expires_in`.


6. **Auth failures (learn the edge)** — same URL and variables as step 5. You **leave a header off** (or send an empty body). That is how you make it fail. Same terminal.

   **No JWT** (drop `Authorization`). API Gateway never reaches the Lambda:

```bash
curl -sS -D - -X POST "$API_BASE/movements" \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  --data-binary @learn/fixtures/create-movement.json
```

Expect HTTP **401** and `{"message":"Unauthorized"}`.

   **No API key** (drop `x-api-key`). Usage plan rejects it:

```bash
curl -sS -D - -X POST "$API_BASE/movements" \
  -H "Authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  --data-binary @learn/fixtures/create-movement.json
```

Expect HTTP **403** and a `Forbidden` / `Missing Authentication Token` style body (API Gateway, not our JSON `validation.errors`).

   **Both credentials, empty JSON.** Authorizer passes; Lambda validation fails:

```bash
curl -sS -D - -X POST "$API_BASE/movements" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  --data '{}'
```

Expect HTTP **400** and `validation.errors` with `NotProvided` (for example `apiCode`).


7. [DynamoDB → Tables](https://eu-west-2.console.aws.amazon.com/dynamodbv2/home?region=eu-west-2#tables) → movements table → **Explore table items**. You should see `PK=MOVEMENT#<id>`, `SK=CURRENT` and an `EVENT#…` row.

8. Optional GUI — same two headers and JSON as the curl. Not required for the automated check.

   - [Bruno](../../bruno.md) — install, environment variables, Get token, then POST `/movements`
   - [Postman](../../postman.md) — install, environment, same two requests


## Automated check

After the deploy and a successful `201`:

```bash
npm run learn -- 07
```

The check confirms the stack is `CREATE/UPDATE_COMPLETE` and the REST API exists. It does not POST a movement.

## Quiz

[`quiz.md`](quiz.md)

## Save your work (GitHub)

From the **repo root** (`rubl/`). Why and what not to commit: [`learn/commit.md`](../../commit.md).

```bash
git status
git add -A
git status
git commit -m "learn: complete step 07 — API proving path"
git push
```

`nothing to commit` is fine if you only read. Do not commit `.env`, keys, or tokens.
