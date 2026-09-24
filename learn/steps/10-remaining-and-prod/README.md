# Step 10 — Remaining endpoints and prod promotion

## What is happening

The API already wired **all** OpenAPI operations in `DwtApi` (step 07). This step is about **using** them as a journey, then understanding what “prod” means.

```
POST /movements
  → POST …/collection          (STATIC)
  → POST /deliveries           → deliveryId
  → POST /deliveries/{id}/receipt
  → GET  …/fate-of-waste       CREATED → COLLECTED → DELIVERED → RECEIVED
  → GET  /reference-data/ewc-codes
```

Same `token` + `apiKey` + `apiBase` on every call. Bodies are the fixtures under [`learn/fixtures/`](../../fixtures/). Do not paste tokens or API keys into chat.

Do the journey in **[Bruno](https://www.usebruno.com/)** (install + collection + each request below). [curl](#alternative-curl) is the same HTTP if you prefer the terminal.

## Automated check

```bash
npm run learn -- 10
```

Confirms stacks 05–09 are still complete and lists the remaining route operationIds in the CDK source. It does **not** walk the journey.

## Manual steps — Bruno

### 0. Install Bruno (first time)

If Bruno is already open from [step 05](../05-auth-stack/README.md), [step 07](../07-api-proving-path/README.md), or [learn/bruno.md](../../bruno.md), skip to [step 0b](#0b-create-or-reuse-the-collection).

1. Download from [Bruno downloads](https://www.usebruno.com/downloads), or on macOS:

   ```bash
   brew install --cask bruno
   ```

2. Open **Bruno** from Applications.
3. Confirm **File → New Collection** exists.

Docs: [Bruno documentation](https://docs.usebruno.com/), [environments](https://docs.usebruno.com/variables/environment-variables).

### 0b. Create or reuse the collection

If you already have collection `dwt-sandbox` and environment `dev` from steps 05 / 07, skip to [step 0c](#0c-add-journey-variables) and only add `movementId` / `deliveryId` if they are missing. Keep **Get token** and **Create movement**.

1. **Create Collection** → name `dwt-sandbox`.
2. Save it **outside** this git repo (or add `*.bru` secrets to `.gitignore` if you insist on saving next to the code). Do not commit secrets.
3. Right-click the collection → **Environments** → **Create Environment** → name `dev`.
4. Select **dev** in the environment picker (top right). Leave it selected for every request below.

### 0c. Add journey variables

You still need the AWS CLI once, to **read** CloudFormation outputs into Bruno. You are not creating anything new. Same profile as earlier steps.

```bash
export AWS_PROFILE=dwt-dev
export AWS_DEFAULT_REGION=eu-west-2
```

Those two `export` lines print **nothing**. That is success — they only set this terminal’s profile and region. A blank line is expected.

“Print the next value” means: **run the `aws` command below, look at the one line the terminal writes back, copy that line into Bruno**. You do not add an extra `echo` or `print`. The command’s output *is* the value. Paste it into Bruno’s **`dev` environment** (Name / Value table) — not into chat.

These are **API** values: the Cognito app client is approved **software**; `apiKey` is the sandbox **operator** key. They are **not** your AWS IAM access key / secret key from `aws configure` — those stay in profile `dwt-dev` and never go into Bruno.

Sanity check first (should write `CREATE_COMPLETE` or `UPDATE_COMPLETE`, not a secret):

```bash
aws cloudformation describe-stacks --stack-name DwtApi \
  --query "Stacks[0].StackStatus" --output text
```

If that errors (`stack does not exist`, or ExpiredToken), the profile/region is wrong or the stack is not in **eu-west-2**. Fix that before copying values. Do not paste `sts` / account JSON into chat.

Same data in the console: [CloudFormation stacks](https://eu-west-2.console.aws.amazon.com/cloudformation/home?region=eu-west-2#/stacks) → `DwtApi` / `DwtAuth` → **Outputs**.

Run **one command at a time**. After each, copy the one-line result into the Bruno var named in the heading.

**`apiBase`** — expect `https://….execute-api.eu-west-2.amazonaws.com/prod/dwt`

```bash
aws cloudformation describe-stacks --stack-name DwtApi \
  --query "Stacks[0].Outputs[?OutputKey=='ApiBaseUrl'].OutputValue" --output text
```

**`apiKey`** — first this prints an ARN (`arn:aws:secretsmanager:…`). Copy it, then run the second command with that ARN in place of `<ARN>` (quotes matter). The second line is the **operator** API key (`dwt-operator-sandbox`). Same value in the console: [API keys](https://eu-west-2.console.aws.amazon.com/apigateway/main/api-keys?region=eu-west-2) ([usage plans](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-key-usage-plans.html)).

```bash
aws cloudformation describe-stacks --stack-name DwtApi \
  --query "Stacks[0].Outputs[?OutputKey=='ApiKeySecretArn'].OutputValue" --output text
aws secretsmanager get-secret-value --secret-id "<ARN>" --query SecretString --output text
```

Or open that secret in [Secrets Manager](https://eu-west-2.console.aws.amazon.com/secretsmanager/listsecrets?region=eu-west-2) and copy the string.

**`tokenUrl`** — expect `https://….amazoncognito.com/oauth2/token`

```bash
aws cloudformation describe-stacks --stack-name DwtAuth \
  --query "Stacks[0].Outputs[?OutputKey=='TokenUrl'].OutputValue" --output text
```

**`clientId`** — a long alphanumeric id

```bash
aws cloudformation describe-stacks --stack-name DwtAuth \
  --query "Stacks[0].Outputs[?OutputKey=='ClientId'].OutputValue" --output text
```

Cognito **client secret** (not the API key) — [User pools](https://eu-west-2.console.aws.amazon.com/cognito/v2/idp/user-pools?region=eu-west-2) → your pool → **App clients** → Show secret, or:

The first two lines below are also **silent** (`$(…)` stores the id). Only the last line prints the secret:

```bash
POOL=$(aws cloudformation describe-stacks --stack-name DwtAuth \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
CLIENT_ID=$(aws cloudformation describe-stacks --stack-name DwtAuth \
  --query "Stacks[0].Outputs[?OutputKey=='ClientId'].OutputValue" --output text)
aws cognito-idp describe-user-pool-client \
  --user-pool-id "$POOL" --client-id "$CLIENT_ID" \
  --query 'UserPoolClient.ClientSecret' --output text
```

[Secrets Manager](https://eu-west-2.console.aws.amazon.com/secretsmanager/listsecrets?region=eu-west-2): open the secret from `ApiKeySecretArn` and copy the string. That is `apiKey`.

In Bruno **dev**, add these variables:

| Name | From | What it is |
|---|---|---|
| `apiBase` | `DwtApi` output `ApiBaseUrl` | HTTPS prefix — must end `/prod/dwt` |
| `tokenUrl` | `DwtAuth` output `TokenUrl` | Cognito `/oauth2/token` |
| `clientId` | `DwtAuth` output `ClientId` | Cognito **app client** id (approved software) |
| `clientSecret` | Cognito app client **Show secret** (or the `describe-user-pool-client` command above) | Paired with `clientId` for **Get token**. Not the API key |
| `apiKey` | [Secrets Manager](https://eu-west-2.console.aws.amazon.com/secretsmanager/listsecrets?region=eu-west-2) secret at `ApiKeySecretArn` | The **operator** `x-api-key` (`dwt-operator-sandbox`). Not the Cognito secret, not an IAM key |
| `token` | leave empty | **Get token** fills this JWT |
| `movementId` | leave empty | **Create movement** fills this |
| `deliveryId` | leave empty | **Record delivery** fills this |

**How to record them in Bruno** (the environment, not the Get token form):

1. In the top-right corner, open the environment picker (it may say **No environment** or **dev**).
2. Choose **Configure** (or open the `dev` environment you created in 0b). You should see a table of **Name** / **Value** rows.
3. Click **+** / add a variable. Type the **Name** exactly as in the table (`clientId`, then another row `clientSecret`, and so on). Names are case-sensitive.
4. Paste the matching value into **Value** (from your terminal or CloudFormation **Outputs**). For `token`, `movementId`, and `deliveryId`, leave **Value** blank.
5. If Bruno offers a **Secret** checkbox, tick it for `clientSecret` and `apiKey` so they are not written as plain text next to the collection.
6. **Save**. Then select **dev** in that same top-right picker so it stays active (not **No environment**).

You do **not** type the client id or secret into the **Get token** request itself. That request only references them as `{{clientId}}` and `{{clientSecret}}` (step 1). Bruno substitutes the environment values when you click **Send**.

### 0d. How Bruno requests work in this step

- Environment **dev** must stay selected (top right). `{{apiBase}}` and friends only resolve then.
- **Get token** talks to Cognito (Basic auth). Every later request talks to the waste API and needs two headers:

  | Header | Value |
  |---|---|
  | `Authorization` | `Bearer {{token}}` |
  | `x-api-key` | `{{apiKey}}` |

- After the first API request exists, **duplicate** it for the next call and only change method, URL, and body.
- **Tests** scripts run after **Send**. `bru.setEnvVar` writes into `dev` so the next URL can use `{{movementId}}`.
- Tokens expire (`expires_in` is usually 3600 seconds). If a later call returns **401**, run **Get token** again and retry.

### 1. Get token

This request is **not** the waste API. It asks **Cognito** for a short-lived JWT, the same as lesson 05.

Vendor software proves who it is with `clientId` + `clientSecret` (HTTP Basic). The form body says “client credentials, scope `dwt/movements`.” Cognito replies with JSON that includes `access_token` — a signed string starting `eyJ…`. The **Tests** script copies that string into Bruno’s `token` variable. Later requests send it as `Authorization: Bearer {{token}}`. API Gateway checks the JWT locally; Lambdas do not call Cognito per movement.

Create this request if it is not already in the collection from step 07.

1. New request → name `Get token` → method **POST**.
2. URL: `{{tokenUrl}}` — Cognito `/oauth2/token`, not `{{apiBase}}`.
3. **Auth** → **Basic Auth** → username `{{clientId}}` → password `{{clientSecret}}`.
4. **Body** → **Form URL Encoded**:

   | Key | Value |
   |---|---|
   | `grant_type` | `client_credentials` |
   | `scope` | `dwt/movements` |

5. Open the **Tests** tab on this request (next to Body / Auth — not a terminal). Paste this **once** and leave it there. You do not run it yourself. This request must **only** have this script (do not leave a `movementId` line here):

   ```javascript
   const body = typeof res.getBody === "function" ? res.getBody() : res.body;
   const parsed = typeof body === "string" ? JSON.parse(body) : body;
   if (parsed && parsed.access_token) {
     bru.setEnvVar("token", parsed.access_token);
   }
   ```

   After you click **Send** (step 6), Bruno runs this snippet. It copies Cognito’s JWT into `dev` → `token` only if `access_token` is present, so a failed send cannot wipe the variable.

6. **Send**. Expect **200**. The body has `access_token` (a long `eyJ…` string) and `expires_in` (usually `3600`). Do not screenshot it. Confirm the `dev` variable `token` is now filled.

This still does **not** call `/movements`. You have only logged the vendor software in.

### 2. Create movement → `movementId`

1. New request → name `Create movement` → method **POST**.
2. URL: `{{apiBase}}/movements`
3. **Auth** → **Inherit** or **No Auth** (the header below is the JWT, not Bruno’s Bearer helper).
4. **Headers**:

   | Header | Value |
   |---|---|
   | `Authorization` | `Bearer {{token}}` |
   | `x-api-key` | `{{apiKey}}` |
   | `Content-Type` | `application/json` |

5. **Body** → **JSON**. Paste the contents of [`learn/fixtures/create-movement.json`](../../fixtures/create-movement.json) (the fixture, not secrets).
6. **Tests** tab (the JavaScript panel — **not** the JSON Body). This request’s Tests must **only** set `movementId`. If you duplicated **Get token**, delete any Tests line that mentions `token` or `access_token` (example: `bru.setEnvVar("token", …)`). Leave the JSON Body as the create fixture, including `apiCode`. Unconditional `bru.setEnvVar("movementId", res.body.movementId)` writes empty when Bruno has not parsed the JSON (or the call was not 201) and **wipes** `dev.movementId`:

   ```javascript
   const body = typeof res.getBody === "function" ? res.getBody() : res.body;
   const parsed = typeof body === "string" ? JSON.parse(body) : body;
   if (parsed && parsed.movementId) {
     bru.setEnvVar("movementId", parsed.movementId);
   }
   ```

7. **Send**. Expect **201** and `"movementId": "26…"` (year-prefixed sqid). Confirm `dev` → `movementId` is that same id. If the env is still blank, copy `movementId` from the response JSON into the environment by hand. Fate at this point would be **CREATED**.

### 3. Record STATIC collection

The carrier reports that waste **left the producer**. This is the first collection event (`STATIC`). Fate becomes **COLLECTED**.

1. Duplicate **Create movement** → rename `Record collection`.
2. URL: `{{apiBase}}/movements/{{movementId}}/collection`  
   Confirm `dev` still has `movementId` from step 2 (a `26…` sqid). If the URL shows `{{movementId}}` unsubstituted or `/movements//collection`, run **Create movement** again (or paste the id into `dev`).
3. Keep the same two auth headers. On the **Tests** tab, **delete** the `bru.setEnvVar("movementId", …)` line copied from Create movement — a successful collection has no `movementId` in the body, and that script would wipe the env var.
4. **Body** → **JSON** — replace the create fixture entirely with [`learn/fixtures/record-collection.json`](../../fixtures/record-collection.json). Leaving the create body here is the usual **400**.
5. **Send**. Expect **201** and a body like `{ "validation": { "warnings": [] } }`. There is **no** new id. That is success.

Full `carrier` (registration + VRN) is required here — the create fixture’s `intendedCarriers` is not enough.

| Status | Likely cause |
|---|---|
| **201** | Worked. Empty-looking JSON is normal. |
| **400** `validation.errors` | Body is still create-movement, or `carrier` / `collectionSite` missing |
| **401** | Token expired — run **Get token** again |
| **404** | `movementId` empty or wrong |
| **400** `Next collection event must be TRANSIT` | This movement already has a STATIC collection (an earlier **201** or a retry). Do **not** send STATIC again. Go to step 4 (delivery) with the same `movementId`. Only create a new movement if you want to practise collection from scratch. |

### 4. Record delivery → `deliveryId`

1. Duplicate **Create movement** → rename `Record delivery`.
2. URL: `{{apiBase}}/deliveries`
3. Keep the same two auth headers.
4. **Body** → **JSON** = [`learn/fixtures/record-delivery.json`](../../fixtures/record-delivery.json), then change the placeholder so the array uses the env var:

   ```json
   "movementIds": ["{{movementId}}"]
   ```

5. **Tests** — only this script (delete any copied `movementId` / `token` lines):

   ```javascript
   const body = typeof res.getBody === "function" ? res.getBody() : res.body;
   const parsed = typeof body === "string" ? JSON.parse(body) : body;
   const id = parsed && parsed.deliveries && parsed.deliveries[0] && parsed.deliveries[0].deliveryId;
   if (id) {
     bru.setEnvVar("deliveryId", id);
   }
   ```

6. **Send**. Expect **201** and `deliveries[0].deliveryId`. Confirm `deliveryId` is filled in `dev`.

**401** `{"message":"Unauthorized"}` is the JWT, not the API key (that is **403**). Run **Get token** again (confirm `dev` → `token` starts `eyJ`), check the header is exactly `Authorization: Bearer {{token}}` (space after Bearer), keep environment **dev** selected, then retry this same delivery request. Do not start a new movement.

This fixture is non-hazardous, so AWS **mints** a new `deliveryId`. Fate would be **DELIVERED**.

### 5. Record receipt

The **receiving site** now accepts the waste. Delivery (step 4) only said it arrived; receipt is the terminal legal event (`WASTE_RECEIVED`). Fate becomes **RECEIVED**.

You POST the fixture to `/deliveries/{{deliveryId}}/receipt` — that is why step 4 stored `deliveryId`. The Lambda validates `receiverSite` (name, permit, address, email or phone), writes EVENT + CURRENT, and does not mint a new id.

1. Duplicate **Create movement** → rename `Record receipt`.
2. URL: `{{apiBase}}/deliveries/{{deliveryId}}/receipt`
3. Keep the same two auth headers. Delete any copied `bru.setEnvVar` Tests (receipt returns no new id).
4. **Body** → **JSON** = [`learn/fixtures/record-receipt.json`](../../fixtures/record-receipt.json) (replace the create fixture).
5. **Send**. Expect **201** and `{ "validation": { "warnings": [] } }`.

`receiverSite` needs `siteName`, `authorisationNumber`, `address`, and an email or phone.

### 6. Fate of waste

1. New request (or duplicate and clear the body) → name `Fate of waste` → method **GET**.
2. URL: `{{apiBase}}/movements/{{movementId}}/fate-of-waste`
3. Same two auth headers. No body.
4. **Send**. Expect **200** and `"status": "RECEIVED"`.

`timeline` should list `MOVEMENT_CREATED`, `WASTE_COLLECTED`, `DELIVERY_RECORDED`, `WASTE_RECEIVED`. If you GET after step 2 only, `status` is `CREATED`; after 3 `COLLECTED`; after 4 `DELIVERED`.

### 7. Reference data (no movement)

1. New request → name `EWC codes` → method **GET**.
2. URL: `{{apiBase}}/reference-data/ewc-codes`
3. Same two auth headers. No body.
4. **Send**. Expect **200** and a list of codes (includes `200108` from the fixture).

Siblings you can clone: `/reference-data/hazardous-property-codes`, `disposal-or-recovery-codes`, `container-types`, `pop-names`.

If a write returns **400** `validation.errors`, a required field is missing (collection `carrier` / `collectionSite`, delivery `movementIds`, receipt `receiverSite`). **401** = run **Get token** again. **403** = empty or wrong operator `apiKey`. **404** = `movementId` / `deliveryId` not set or typed by hand.

## Alternative: curl

Same journey, same fixtures, no GUI. Use **this** terminal for every command. Skip this section if you already walked the path in Bruno.

### Collect outputs and mint a token

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

TOKEN=$(curl -sS -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d grant_type=client_credentials \
  -d scope=dwt/movements \
  "$TOKEN_URL" | jq -r .access_token)
echo "API_BASE set: $([ -n "$API_BASE" ] && echo yes || echo NO)"
echo "TOKEN set: $([ -n "$TOKEN" ] && echo yes || echo NO)"
```

Every later request uses `-H "Authorization: Bearer $TOKEN"` and `-H "x-api-key: $API_KEY"`.

### Create movement

```bash
CREATE=$(curl -sS -X POST "$API_BASE/movements" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  --data-binary @learn/fixtures/create-movement.json)
echo "$CREATE" | jq .
MOVEMENT_ID=$(echo "$CREATE" | jq -r .movementId)
echo "MOVEMENT_ID=$MOVEMENT_ID"
```

Expect **201** and a year-prefixed `movementId`.

### Record STATIC collection

```bash
curl -sS -D - -X POST "$API_BASE/movements/$MOVEMENT_ID/collection" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  --data-binary @learn/fixtures/record-collection.json
```

Expect **201**.

### Record delivery

`jq` injects `$MOVEMENT_ID` so you do not edit the fixture:

```bash
DELIVER=$(jq --arg id "$MOVEMENT_ID" '.movementIds = [$id]' learn/fixtures/record-delivery.json | \
  curl -sS -X POST "$API_BASE/deliveries" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-api-key: $API_KEY" \
    -H "content-type: application/json" \
    --data-binary @-)
echo "$DELIVER" | jq .
DELIVERY_ID=$(echo "$DELIVER" | jq -r '.deliveries[0].deliveryId')
echo "DELIVERY_ID=$DELIVERY_ID"
```

Expect **201**.

### Record receipt

```bash
curl -sS -D - -X POST "$API_BASE/deliveries/$DELIVERY_ID/receipt" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  --data-binary @learn/fixtures/record-receipt.json
```

Expect **201**.

### Fate of waste

```bash
curl -sS "$API_BASE/movements/$MOVEMENT_ID/fate-of-waste" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-api-key: $API_KEY" | jq .
```

Expect **200** and `"status": "RECEIVED"`.

### Reference data

```bash
curl -sS "$API_BASE/reference-data/ewc-codes" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-api-key: $API_KEY" | jq '.[0:3]'
```

Expect **200**.

## After the journey (Bruno or curl)

### 8. Optional — CURRENT in DynamoDB

After any write, the movements table snapshot should match fate. Do not create a table. Copy `movementId` from Bruno’s `dev` environment (or `$MOVEMENT_ID` from curl).

```bash
TABLE=$(aws cloudformation describe-stacks --stack-name DwtLedger \
  --query "Stacks[0].Outputs[?OutputKey=='MovementsTableName'].OutputValue" --output text)
aws dynamodb get-item --table-name "$TABLE" \
  --key "{\"PK\":{\"S\":\"MOVEMENT#$MOVEMENT_ID\"},\"SK\":{\"S\":\"CURRENT\"}}" \
  --query 'Item.{hasCollection:hasCollection.BOOL,hasDelivery:hasDelivery.BOOL,hasReceipt:hasReceipt.BOOL}' \
  --output table
```

After step 5 all three should be `True`. [Explore table items](https://eu-west-2.console.aws.amazon.com/dynamodbv2/home?region=eu-west-2#tables) on the `DwtLedger-Movements…` table if you prefer the console.

### 9. What “prod” means

Read [learn/environments.md](../../environments.md) **prod** section again. Checklist before any real prod account (do not run these against sandbox as if they were prod):

- Separate AWS account and profile
- `RemovalPolicy.RETAIN` on tables and the lake bucket
- No `autoDeleteObjects` on S3
- WAF / private API if a Defra landing zone requires it (out of scope for this sandbox)
- Secrets rotation for Cognito client and API key
- `cdk diff` reviewed by a human before `cdk deploy`

### 10. Tear down the sandbox (when you have finished learning)

The full procedure — confirm the sandbox, destroy dependents first, leave `CDKToolkit`, handle a leftover lake bucket, then recreate one stack per lesson and refresh Bruno — lives in the [destroy and rebuild appendix](../appendix-destroy-rebuild/README.md). Follow that copy so this paragraph and the Q&A do not drift.

Order still matters: dependents first (`DwtApi`, `DwtCharging`, `DwtEvents`, then `DwtLedger`, then `DwtAuth`). Do not destroy `CDKToolkit`. Do not close the account or delete the [IAM](https://console.aws.amazon.com/iam/home#/users) ([IAM users](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html)) / [IAM Identity Center](https://eu-west-2.console.aws.amazon.com/singlesignon/home?region=eu-west-2#/instances) ([what Identity Center is](https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html)) user.

```bash
npx cdk destroy DwtApi DwtCharging DwtEvents DwtLedger DwtAuth
```

Then deploy again in lesson order (Auth → Ledger → Api → Events → Charging), not `--all`. The appendix has the CLI commands, the CloudFormation console alternative, and the automated checks.

## Quiz

[`quiz.md`](quiz.md)

## Next

Offline vendors need an ID *before* DynamoDB has CURRENT: [step 11](../11-offline-ids/README.md).

Keep using [learn/qa/index.md](../../qa/index.md). Next questions you ask in Cursor should land there automatically (see `.cursor/rules/tutorial-qa.mdc`).

## Save your work (GitHub)

From the **repo root** (`rubl/`). Why and what not to commit: [`learn/commit.md`](../../commit.md).

```bash
git status
git add -A
git status
git commit -m "learn: complete step 10 — remaining and prod"
git push
```

`nothing to commit` is fine if you only read. Do not commit `.env`, keys, or tokens.
