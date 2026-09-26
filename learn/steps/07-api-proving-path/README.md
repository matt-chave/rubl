# Step 07 — API + POST /movements (proving path)

## What is happening

This is the first **end-to-end write** approved software will do for a waste operator:

1. Software JWT from Cognito (step 05)
2. Operator `x-api-key` from Secrets Manager (stack output `ApiKeySecretArn` — the seeded key `dwt-operator-sandbox`)
3. `POST /dwt/movements` with `[learn/fixtures/create-movement.json](../../fixtures/create-movement.json)`
4. Lambda validates, mints a sqid, `PutItem` EVENT + CURRENT
5. 201 `{ movementId, validation: { warnings } }`

Lake and charging are **not** required for this HTTP success. That is the point of EDA: ingestion is complete when DynamoDB has the event.

Do the proving path in **[Bruno](https://www.usebruno.com/)** (reuse the collection from [step 05](../05-auth-stack/README.md) if you have it). [curl](#alternative-curl) is the same HTTP if you prefer the terminal. Do not paste tokens or API keys into chat.

## Where the code is

The CloudFormation stack `DwtApi` is `[infra/lib/stacks/api-stack.ts](../../../infra/lib/stacks/api-stack.ts)` (wired as `new ApiStack(app, 'DwtApi', …)` in `[infra/bin/app.ts](../../../infra/bin/app.ts)`). **Read that file before you deploy** — the comments are the explanation. CDK creates:

- API Gateway **REST** (v1) named `digital-waste-tracking` — not HTTP API, because usage plans need REST
- Cognito JWT authorizer on the pool from `DwtAuth` (checks the token locally; Lambdas do not call Cognito)
- One sandbox **operator API key** (`dwt-operator-sandbox`) associated with usage plan `dwt-operators` from `DwtOnboarding` — not the Cognito client secret. This stack attaches that plan to the movements API stage so both the sandbox key and keys from [step 05b](../05b-operator-onboarding/README.md) can call `POST /movements`. Production issues a key per operator at onboarding, not at `cdk deploy`. The operator hands that key to their software; DWT does not pair them at auth time.
- Path prefix `/dwt` to match OpenAPI
- One Lambda per OpenAPI `operationId` (`[infra/lib/constructs/dwt-lambda.ts](../../../infra/lib/constructs/dwt-lambda.ts)` → `[src/lambdas/<id>/](../../../src/lambdas/)`), with `OPERATORS_TABLE` so non-sandbox keys resolve without calling onboarding over HTTP

Do **not** click **Create API** in [API Gateway](https://eu-west-2.console.aws.amazon.com/apigateway/main/apis?region=eu-west-2) first. This stack does not create tables or the User Pool. Stage name `prod` is the Gateway stage, not the AWS prod account.

## Why this stack alone

If the edge is wrong (401/403), you never know whether validation or DynamoDB failed. Prove `POST /dwt/movements` → 201 and two ledger rows before the lake exists.

## Manual steps (deploy first)

Same order as 05/06: **read, deploy, look, then the check**. `DwtApi` needs Auth, Onboarding, and Ledger already deployed.

1. Open `[infra/lib/stacks/api-stack.ts](../../../infra/lib/stacks/api-stack.ts)` and walk REST → authorizer → sandbox operator key → attach `dwt-operators` from onboarding → `/dwt` → `ROUTES`. There is no `PutEvents`. The JWT is software; the key is the operator. You may use either the sandbox key or an operator key from [step 05b](../05b-operator-onboarding/README.md) with a software client from [step 05](../05-auth-stack/README.md).
2. Reuse the same profile as step 05 if this is a new terminal, then deploy (this can take a few minutes — many Lambdas). CDK will ask about **IAM** (Lambda roles, DynamoDB access). That is expected — type `y`. It is not the failure.

```bash
export AWS_PROFILE=dwt-dev
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=eu-west-2
npx cdk deploy DwtApi
```

If you already deployed an older `dwt-vendor-key`, this deploy replaces it with the sandbox operator key `dwt-operator-sandbox`. Copy the new secret into Bruno `apiKey`. If a previous attempt rolled back, wait until `aws cloudformation describe-stacks --stack-name DwtApi` shows `ROLLBACK_COMPLETE`, `UPDATE_ROLLBACK_COMPLETE`, or the stack is gone, then deploy again. The stack is ready to update when status ends in `_COMPLETE` (including a completed rollback); do not retry while it still says `_IN_PROGRESS`.

## Manual steps — Bruno



### 0. Collection and environment

If you already have collection `dwt-sandbox` and environment **dev** from [step 05](../05-auth-stack/README.md) or `[learn/bruno.md](../../bruno.md)`, skip to [step 0b](#0b-add-api-variables) and only add `apiBase` / `apiKey`.

1. Download from [Bruno downloads](https://www.usebruno.com/downloads), or on macOS: `brew install --cask bruno`.
2. Open **Bruno**. **Create Collection** → name `dwt-sandbox`. Save it **outside** this git repo. Do not commit secrets.
3. **Environments** → **Create Environment** → name `dev`. Select **dev** (top right).

Docs: [Bruno documentation](https://docs.usebruno.com/), [environments](https://docs.usebruno.com/variables/environment-variables).

### 0b. Add API variables

You still need the AWS CLI once, to **read** CloudFormation outputs into Bruno. Same profile as the deploy.

```bash
export AWS_PROFILE=dwt-dev
export AWS_DEFAULT_REGION=eu-west-2
```

Those two `export` lines print **nothing**. That is success.

These are **API** values: the Cognito app client is approved **software**; `apiKey` is the sandbox **operator** key. They are **not** your AWS IAM access key from `aws configure`. Paste into Bruno’s `dev` **environment** — not into chat.

Sanity check first (should write `CREATE_COMPLETE` or `UPDATE_COMPLETE`, not a secret):

```bash
aws cloudformation describe-stacks --stack-name DwtApi \
  --query "Stacks[0].StackStatus" --output text
```

Same data in the console: [CloudFormation stacks](https://eu-west-2.console.aws.amazon.com/cloudformation/home?region=eu-west-2#/stacks) → `DwtApi` / `DwtAuth` → **Outputs**.

Run **one command at a time**. After each, copy the one-line result into the Bruno var named in the heading.

`apiBase` — expect `https://….execute-api.eu-west-2.amazonaws.com/prod/dwt`

```bash
aws cloudformation describe-stacks --stack-name DwtApi \
  --query "Stacks[0].Outputs[?OutputKey=='ApiBaseUrl'].OutputValue" --output text
```

`apiKey` — first this prints an ARN (`arn:aws:secretsmanager:…`). Copy it, then run the second command with that ARN in place of `<ARN>` (quotes matter). The second line is the **operator** API key (`dwt-operator-sandbox`). Same value in the console: [API keys](https://eu-west-2.console.aws.amazon.com/apigateway/main/api-keys?region=eu-west-2) ([usage plans](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-key-usage-plans.html)). The stack also outputs `SandboxOperatorId` (`OP-SANDBOX-1`); you do not paste that into Bruno.

```bash
aws cloudformation describe-stacks --stack-name DwtApi \
  --query "Stacks[0].Outputs[?OutputKey=='ApiKeySecretArn'].OutputValue" --output text
aws secretsmanager get-secret-value --secret-id "<ARN>" --query SecretString --output text
```

Or open that secret in [Secrets Manager](https://eu-west-2.console.aws.amazon.com/secretsmanager/listsecrets?region=eu-west-2) and copy the string.

If **Get token** is not already in the collection, also copy `tokenUrl`, `clientId`, and `clientSecret` as in [step 05](../05-auth-stack/README.md) (or the `describe-stacks` / `describe-user-pool-client` commands in the [curl alternative](#alternative-curl)).

In Bruno **dev**, you now need:


| Name           | From                                                                                                                                                                                                                  | What it is                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `apiBase`      | `DwtApi` output `ApiBaseUrl`                                                                                                                                                                                          | HTTPS prefix — must end `/prod/dwt`                                                                           |
| `tokenUrl`     | `DwtAuth` output `TokenUrl`                                                                                                                                                                                           | Cognito `/oauth2/token` (from step 05)                                                                        |
| `clientId`     | `DwtAuth` output `ClientId`                                                                                                                                                                                           | Cognito **app client** id (approved software)                                                                 |
| `clientSecret` | Cognito app client **Show secret**                                                                                                                                                                                    | For **Get token**. Not the API key                                                                            |
| `apiKey`       | [Secrets Manager](https://eu-west-2.console.aws.amazon.com/secretsmanager/listsecrets?region=eu-west-2) secret at `ApiKeySecretArn`, **or** the key returned once by [step 05b](../05b-operator-onboarding/README.md) | The **operator** `x-api-key` (`dwt-operator-sandbox` or a signup key). Not the Cognito secret, not an IAM key |
| `token`        | leave empty                                                                                                                                                                                                           | **Get token** fills this JWT                                                                                  |
| `movementId`   | leave empty                                                                                                                                                                                                           | **Create movement** fills this                                                                                |


Tick **Secret** for `clientSecret` and `apiKey` if Bruno offers it. **Save**. Keep **dev** selected.

### 0c. How Bruno requests work in this step

- Environment **dev** must stay selected (top right). `{{apiBase}}` only resolves then.
- **Get token** talks to Cognito (Basic auth). **Create movement** talks to the waste API and needs two headers:

  | Header          | Value              |
  | --------------- | ------------------ |
  | `Authorization` | `Bearer {{token}}` |
  | `x-api-key`     | `{{apiKey}}`       |

- Tokens expire (`expires_in` is usually 3600 seconds). If create returns **401**, run **Get token** again and retry.



### 1. Get token

Create this request if it is not already in the collection from step 05. Same click-by-click as [step 05 §4c](../05-auth-stack/README.md#4c-request--get-token): **POST** `{{tokenUrl}}`, Basic auth `{{clientId}}` / `{{clientSecret}}`, form body `grant_type=client_credentials` and `scope=dwt/movements`, Tests script that sets `token` from `access_token`.

**Send**. Expect **200**. Confirm `dev` → `token` starts `eyJ`. This still does **not** call `/movements`.

### 2. Create movement → `movementId`

1. New request → name `Create movement` → method **POST**.
2. URL: `{{apiBase}}/movements`
3. **Auth** → **Inherit** or **No Auth** (the header below is the JWT, not Bruno’s Bearer helper).
4. **Headers**:

  | Header          | Value              |
  | --------------- | ------------------ |
  | `Authorization` | `Bearer {{token}}` |
  | `x-api-key`     | `{{apiKey}}`       |
  | `Content-Type`  | `application/json` |

5. **Body** → **JSON**. Paste the contents of `[learn/fixtures/create-movement.json](../../fixtures/create-movement.json)` (the fixture, not secrets).
6. **Tests** tab — this request must **only** set `movementId`. If you duplicated **Get token**, delete any Tests line that mentions `token` or `access_token`:
  ```javascript
   const body = typeof res.getBody === "function" ? res.getBody() : res.body;
   const parsed = typeof body === "string" ? JSON.parse(body) : body;
   if (parsed && parsed.movementId) {
     bru.setEnvVar("movementId", parsed.movementId);
   }
  ```
7. **Send**. Expect **201** and `"movementId": "26…"` (year-prefixed sqid). Confirm `dev` → `movementId` is that same id. Copy it if you want it for the DynamoDB look below.

If you get **401** `{"message":"Unauthorized"}` (not 403): that is the JWT authorizer, not the API key. Confirm `dev` → `token` starts `eyJ`. Then **redeploy** `DwtApi` so methods include `authorizationScopes: ['dwt/movements']`. Without that scope list, API Gateway expects a Cognito **ID** token; client credentials issue an **access** token, so 401 is expected until the stack is updated. Answer `y` if CDK asks about IAM. Run **Get token** again if the JWT is older than `expires_in`.

### 3. Auth failures (learn the edge)

Duplicate **Create movement** for each case. You **leave a header off** (or send an empty body). That is how you make it fail.

**No JWT** — duplicate, delete the `Authorization` header. **Send**. Expect **401** and `{"message":"Unauthorized"}`. API Gateway never reaches the Lambda.

**No API key** — duplicate, delete `x-api-key`. **Send**. Expect **403** and a `Forbidden` / `Missing Authentication Token` style body (API Gateway, not our JSON `validation.errors`).

**Both credentials, empty JSON** — duplicate, keep both headers, set **Body** to `{}`. **Send**. Expect **400** and `validation.errors` with `NotProvided` (for example `apiCode`).


| Status                      | Likely cause                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| **201**                     | Happy path. Ledger has EVENT + CURRENT                                                       |
| **400** `validation.errors` | Body is `{}` or a required field (`apiCode`, …) is missing                                   |
| **401**                     | Token empty / expired — run **Get token** again; or `authorizationScopes` missing (redeploy) |
| **403**                     | Empty or wrong operator `apiKey` (not the Cognito secret)                                    |




### 4. CURRENT in DynamoDB

[DynamoDB → Tables](https://eu-west-2.console.aws.amazon.com/dynamodbv2/home?region=eu-west-2#tables) ([docs](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/WorkingWithItems.html)) → movements table → **Explore table items**. You should see `PK=MOVEMENT#<id>`, `SK=CURRENT` and an `EVENT#…` row. Copy `movementId` from Bruno’s `dev` environment.

## Alternative: curl

Same proving path, same fixture, no GUI. Use **this** terminal for every command. Skip this section if you already walked the path in Bruno.

### Collect outputs and mint a token

CDK wrote these as CloudFormation **outputs** when the stacks deployed. You are **reading** those labels so you do not type hashed API ids by hand.

```bash
export AWS_PROFILE=dwt-dev
API_BASE=$(aws cloudformation describe-stacks --stack-name DwtApi \
  --query "Stacks[0].Outputs[?OutputKey=='ApiBaseUrl'].OutputValue" --output text)
SECRET_ARN=$(aws cloudformation describe-stacks --stack-name DwtApi \
  --query "Stacks[0].Outputs[?OutputKey=='ApiKeySecretArn'].OutputValue" --output text)
API_KEY=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" --query SecretString --output text)
TOKEN_URL=$(aws cloudformation describe-stacks --stack-name DwtAuth \
  --query "Stacks[0].Outputs[?OutputKey=='TokenUrl'].OutputValue" --output text)
export CLIENT_ID=$(aws cloudformation describe-stacks --stack-name DwtAuth \
  --query "Stacks[0].Outputs[?OutputKey=='ClientId'].OutputValue" --output text)
POOL=$(aws cloudformation describe-stacks --stack-name DwtAuth \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
export CLIENT_SECRET=$(aws cognito-idp describe-user-pool-client \
  --user-pool-id "$POOL" --client-id "$CLIENT_ID" \
  --query 'UserPoolClient.ClientSecret' --output text)
echo "API_BASE set: $([ -n "$API_BASE" ] && echo yes || echo NO)"
```

The `$(…)` lines are **silent on success**. Optional: `echo "$API_BASE"` should look like `https://….execute-api.eu-west-2.amazonaws.com/prod/dwt`. Do not paste `API_KEY` into chat.

```bash
TOKEN=$(curl -sS -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d grant_type=client_credentials \
  -d scope=dwt/movements \
  "$TOKEN_URL" | jq -r .access_token)
echo "TOKEN set: $([ -n "$TOKEN" ] && echo yes || echo NO)"
```

The `jq -r .access_token` keeps **only** the JWT (`eyJ…`) for `Authorization: Bearer`. Lesson 05’s curl stored the whole JSON in `TOKEN`; here you need the inner field. This still does **not** call `/movements`.

### Happy path

```bash
curl -sS -D - -X POST "$API_BASE/movements" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  --data-binary @learn/fixtures/create-movement.json
```

Expect `201` and a `movementId`. Copy it.

If you get **401** `{"message":"Unauthorized"}` (not 403): confirm `echo "${TOKEN:0:3}"` prints `eyJ` (if it prints `nul`, `jq` did not find `access_token` — re-run the token curl without `| jq`). Then **redeploy** `DwtApi` so methods include `authorizationScopes: ['dwt/movements']`. Re-collect `TOKEN` if it is older than `expires_in`.

### Auth failures

**No JWT** (drop `Authorization`):

```bash
curl -sS -D - -X POST "$API_BASE/movements" \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  --data-binary @learn/fixtures/create-movement.json
```

Expect HTTP **401**.

**No API key** (drop `x-api-key`):

```bash
curl -sS -D - -X POST "$API_BASE/movements" \
  -H "Authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  --data-binary @learn/fixtures/create-movement.json
```

Expect HTTP **403**.

**Both credentials, empty JSON:**

```bash
curl -sS -D - -X POST "$API_BASE/movements" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  --data '{}'
```

Expect HTTP **400** and `validation.errors` with `NotProvided` (for example `apiCode`).

## Automated check

After the deploy and a successful `201`:

```bash
npm run learn -- 07
```

The check confirms the stack is `CREATE/UPDATE_COMPLETE` and the REST API exists. It does not POST a movement.

## Quiz

`[quiz.md](quiz.md)`

## Save your work (GitHub)

From the **repo root** (`rubl/`). Why and what not to commit: `[learn/commit.md](../../commit.md)`.

```bash
git status
git add -A
git status
git commit -m "learn: complete step 07 — API proving path"
git push
```

`nothing to commit` is fine if you only read. Do not commit `.env`, keys, or tokens.