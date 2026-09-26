# Step 05 — Deploy Cognito, onboard a software provider, and get a token (AWS `dev`)

## What is happening

The **onboarding team** owns two registration front doors: software-provider signup and waste-operator signup. You meet that team here. This lesson deploys Cognito for approved software, then deploys `DwtOnboarding` so a software provider can self-register through a GOV.UK Web Component and receive a Cognito app client. Lesson [05b](../05b-operator-onboarding/README.md) covers the operator form. Lesson [12](../12-create-movement-mfe/README.md) continues the same widget pattern for create-movement.

Approved software is a **machine**, not a human clicking a login page. It uses OAuth2 **client credentials**: a `client_id` + `client_secret` exchanged for a JWT. API Gateway will later check that JWT *locally* (JWKS). Lambdas never call Cognito per movement — at 500M movements/year that would DDoS the IdP.

Cognito is a **stand-in** for Defra identity. Swapping the issuer later should not rewrite handlers. The waste **operator** is a different identity: DWT issues that caller an API key at operator onboarding (lesson 5b). This lesson creates the software credential path. The sandbox operator key still arrives with `DwtApi` in [step 07](../07-api-proving-path/README.md) as a fallback proving path.

Registration routes on `DwtOnboarding` are a **front door**, not the movements API. They do not require an operator key. They also do not write waste movements.

## JWT vs API key

A **[JWT](https://jwt.io/introduction)** (JSON Web Token) is a short-lived **signed** string (`header.payload.signature`). Cognito issues it when software calls the token URL. Later, API Gateway checks the signature locally ([JWKS](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html)) — “this **software** is approved, until `exp`.” It is **not** an API key and it is not the waste operator.

An **[API key](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-key-source.html)** is a separate long-lived string on API Gateway (`x-api-key`). In this design it is the **operator** credential issued at operator onboarding, and it also sits on a [usage plan](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-key-usage-plans.html) so we can throttle or revoke one operator. You do not have one yet from this lesson; operator signup is [step 05b](../05b-operator-onboarding/README.md), and the sandbox key `dwt-operator-sandbox` arrives in step 07. The movements API will require **both**: `Authorization: Bearer <software JWT>` and `x-api-key: <operator key>`.

The operator gives that key to their software provider, or pastes it into the product’s config. DWT does not pair operator to software at auth time. Any approved software plus a valid operator key may submit. We still record which software called (`client_id` on the write). Do not send `X-Operator-Id` as identity.

The `client_id` + `client_secret` are also not the API key. They are the software’s password to **ask Cognito for a JWT**. You do not send the secret on every `POST /movements`.

## Where the code is

### `DwtAuth`

The CloudFormation stack `DwtAuth` is [`infra/lib/stacks/auth-stack.ts`](../../../infra/lib/stacks/auth-stack.ts) (wired as `new AuthStack(app, 'DwtAuth', …)` in [`infra/bin/app.ts`](../../../infra/bin/app.ts)). **Read that file before you deploy** — the comments are the explanation. CDK creates:

- User Pool `dwt-vendor-m2m` — the **type** (approved software identity store; no Cognito *users*; `selfSignUpEnabled` is false)
- Resource server scope `dwt/movements` — what that type of caller may request
- App client `dwt-vendor-software` — **one** sandbox software product (`client_id` + secret, client-credentials only) so you can prove the token URL before anyone has signed up. A new approved product must **not** mean another `cdk deploy DwtAuth`. Self signup (below) calls Cognito `CreateUserPoolClient` on this same pool.
- Hosted domain so `/oauth2/token` exists

Do **not** click **Create user pool** or **Create user** in the [Cognito console](https://eu-west-2.console.aws.amazon.com/cognito/v2/idp/user-pools?region=eu-west-2) first. An empty list is expected. Docs: [app clients](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-client-apps.html).

### `DwtOnboarding`

The stack `DwtOnboarding` is [`infra/lib/stacks/onboarding-stack.ts`](../../../infra/lib/stacks/onboarding-stack.ts). Deploy it **after** `DwtAuth` in this lesson. It creates:

- `POST /software-providers` — product name and provider contact email; Lambda calls Cognito `CreateUserPoolClient` (secret, client-credentials, scope `dwt/movements`); stores `softwareProviderId`, product name, contact email, and `clientId`; returns `clientId`, `clientSecret`, and `tokenUrl` **once** (secret is not stored)
- Tables and the operator route used in lesson 5b (you can ignore `POST /operators` until then)
- Public registration API (no operator key). This is not `DwtApi` and not `POST /movements`

### Sign-up micro-frontend

- Web Component `dwt-software-provider-signup` in [`packages/dwt-mfe-software-provider-signup`](../../../packages/dwt-mfe-software-provider-signup) — uses `@dwt/govuk`, emits `dwt-change` / `dwt-submit`, does **not** call AWS or hold secrets
- Host page [`apps/dwt-onboarding-ui`](../../../apps/dwt-onboarding-ui) mounts the tag; the local BFF ([`apps/dwt-bff`](../../../apps/dwt-bff)) posts to the onboarding API and the host shows credentials after success

## Why these stacks first

If auth is wrong, every later API test looks like a Lambda bug. Prove the token URL first. Self signup proves that a new software product does not require another Auth deploy.

## Manual steps

Do these **in order**. You need the deploys (profile, bootstrap, `cdk deploy`) **before** the signup form and Bruno (or curl). `npm run learn -- 05` is last — that is the green tick, not the deploy.

1. Open [`infra/lib/stacks/auth-stack.ts`](../../../infra/lib/stacks/auth-stack.ts) and walk the constructs against the comments (pool → scope → app client → domain). There is no `CognitoUser`. Skim [`infra/lib/stacks/onboarding-stack.ts`](../../../infra/lib/stacks/onboarding-stack.ts) for `CreateUserPoolClient` and `POST /software-providers`.
2. In a terminal (keep it open):

```bash
# profile name from step 04 — not an account number, not the IAM user name
export AWS_PROFILE=dwt-dev
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=eu-west-2

# first time in this account only:
npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/eu-west-2

npx cdk deploy DwtAuth
npx cdk deploy DwtOnboarding
```

`DwtAuth` prints `TokenUrl` and `OAuthScope` (`dwt/movements`). `DwtOnboarding` prints `OnboardingApiBaseUrl`. Do not deploy again unless you changed the stacks.

3. **Primary path — software provider signup form**

   You are about to open a **local** signup page in the browser. It is not an AWS console screen and it is not hosted on the internet. The page is a Vite app in this repo (`apps/dwt-onboarding-ui`). The browser talks only to that app on port `5174`. When you submit the form, the app calls a small local backend (the BFF on port `8787`) through Vite’s proxy. The BFF holds the deployed onboarding URL and secrets so they never sit in the browser; it then calls your `DwtOnboarding` API in AWS. That is why two processes must be running before the page works: the UI serves the form, and the BFF is the only process that may reach CloudFormation’s onboarding base URL.

   Point the BFF at the API you just deployed. A shell `export` alone is not enough — the BFF reads `.env.local` when it starts. Create that file only if it is missing (do not overwrite an existing `.env.local`):

   ```bash
   test -f apps/dwt-bff/.env.local || cp apps/dwt-bff/.env.example apps/dwt-bff/.env.local
   ```

   With the same AWS profile as the deploy, print the `OnboardingApiBaseUrl` stack output (you can also copy it from [CloudFormation](https://eu-west-2.console.aws.amazon.com/cloudformation/home?region=eu-west-2) → stack `DwtOnboarding` → **Outputs** → `OnboardingApiBaseUrl`):

   ```bash
   export AWS_PROFILE=dwt-dev
   export AWS_DEFAULT_REGION=eu-west-2
   aws cloudformation describe-stacks --stack-name DwtOnboarding \
     --query "Stacks[0].Outputs[?OutputKey=='OnboardingApiBaseUrl'].OutputValue" --output text
   ```

   Paste that one-line URL after `ONBOARDING_API_BASE=` in `apps/dwt-bff/.env.local` (no trailing slash, no quotes). Leave `API_BASE`, `CLIENT_ID`, and the other movements values empty for now if you have not reached step 07.

   From the **repo root**, open two terminal sessions (Cursor: **Terminal → New Terminal**, or the **+** in the terminal panel). Both must keep running — do not use one shell for both unless you background the first.

   In the first terminal, start the BFF and leave it open. Ready looks like a listening message on port `8787`:

   ```bash
   npm run bff
   ```

   In the second terminal, start the onboarding UI and leave it open. Ready looks like Vite printing `Local: http://127.0.0.1:5174/`:

   ```bash
   npm run onboarding-ui
   ```

   Opening the browser earlier (or without `onboarding-ui`) fails with connection refused because nothing is on that port yet. When you see the Vite line, open [http://127.0.0.1:5174](http://127.0.0.1:5174), choose **Register as a software provider**, and submit a product name and contact email. The host page shows `clientId`, `clientSecret`, and `tokenUrl` once. Copy them into a password manager — not git, not chat, not the widget source. If a port is already in use, stop the old process rather than starting a second copy. If the form submits but the BFF logs that `ONBOARDING_API_BASE` is missing, fill `.env.local` and restart `npm run bff`.

   After a successful signup, confirm the vendor was stored in AWS — not under Cognito **Users**, and not as an IAM user. Approved software is a machine credential, so Cognito holds an **app client** on the same pool as the sandbox client, and DynamoDB holds the registration profile.

   - Open [Cognito → User pools](https://eu-west-2.console.aws.amazon.com/cognito/v2/idp/user-pools?region=eu-west-2) in **eu-west-2**. Click pool **`dwt-vendor-m2m`**, then **App integration** → **App clients** (newer console: **Applications**). You should see the CDK sandbox client **`dwt-vendor-software`** and a separate client named like **`dwt-provider-…`** for the product you just registered. The **Users** list stays empty — that is expected.
   - Open [DynamoDB → Tables](https://eu-west-2.console.aws.amazon.com/dynamodbv2/home?region=eu-west-2#tables). The physical table name is stack output `SoftwareProvidersTableName` on `DwtOnboarding` (it looks like `DwtOnboarding-SoftwareProviders…`, not the literal word `SoftwareProviders`). Select that table → **Explore table items** → **Run**. Expect one row per signup with partition key `PK` shaped `SOFTWARE#…`, plus `clientId` and `clientName` matching the Cognito app client. The `clientSecret` is not stored here.

4. **Get a token** with the new client (or the sandbox fallback in step 5).

### Optional: sandbox client from the console

If you prefer not to run the form yet, use the seeded app client `dwt-vendor-software` after deploy, **not** from Users:

   - Open [Cognito → User pools](https://eu-west-2.console.aws.amazon.com/cognito/v2/idp/user-pools?region=eu-west-2) ([app clients](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-client-apps.html)). Region must be **London (eu-west-2)**.
   - Click pool **`dwt-vendor-m2m`**.
   - Tab **App integration** (newer console: **Applications**). Do not use **Users**.
   - Open app client **`dwt-vendor-software`**.
   - **Client ID** is on that page. It is also stack output `ClientId` from the deploy (or `aws cloudformation describe-stacks --stack-name DwtAuth --query "Stacks[0].Outputs[?OutputKey=='ClientId'].OutputValue" --output text`).
   - **Client secret:** **Show** / **View client secret**. CDK does **not** print it (see `ClientSecretNote`). Copy it into a password manager — not git, not chat, not the repo.

   Optional CLI for the secret (same terminal, do not paste the value here):

   ```bash
   POOL=$(aws cloudformation describe-stacks --stack-name DwtAuth \
     --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
   CLIENT=$(aws cloudformation describe-stacks --stack-name DwtAuth \
     --query "Stacks[0].Outputs[?OutputKey=='ClientId'].OutputValue" --output text)
   aws cognito-idp describe-user-pool-client --user-pool-id "$POOL" --client-id "$CLIENT" \
     --query 'UserPoolClient.ClientSecret' --output text
   ```

5. Prove the issuer in **[Bruno](https://www.usebruno.com/)**: exchange the app client’s `client_id` + `client_secret` for a JWT (OAuth2 **client credentials**). This is **not** a waste-API call — `DwtApi` does not exist yet. Do **not** create a **Create movement** request. [curl](#alternative-curl) is the same HTTP if you prefer the terminal. Shared install notes: [`learn/bruno.md`](../../bruno.md).

### 5a. Install Bruno (first time)

1. Download from [Bruno downloads](https://www.usebruno.com/downloads), or on macOS:

   ```bash
   brew install --cask bruno
   ```

2. Open **Bruno** from Applications.
3. Confirm **File → New Collection** exists.

Docs: [Bruno documentation](https://docs.usebruno.com/), [environments](https://docs.usebruno.com/variables/environment-variables).

### 5b. Collection `dwt-sandbox` and environment `dev`

1. **Create Collection** → name `dwt-sandbox`.
2. Save it **outside** this git repo (or add `*.bru` secrets to `.gitignore` if you insist on saving next to the code). Do not commit secrets.
3. Right-click the collection → **Environments** → **Create Environment** → name `dev`.
4. Select **dev** in the environment picker (top right). Leave it selected.

You still need the AWS CLI once, to **read** CloudFormation outputs into Bruno. Same profile as the deploy. Those two `export` lines print **nothing** — a blank line is expected.

```bash
export AWS_PROFILE=dwt-dev
export AWS_DEFAULT_REGION=eu-west-2
```

These are **software** values (Cognito app client). They are **not** your AWS IAM access key from `aws configure`, and they are **not** the operator API key. Paste into Bruno’s **`dev` environment** — not into chat.

Same data in the console: [CloudFormation stacks](https://eu-west-2.console.aws.amazon.com/cloudformation/home?region=eu-west-2#/stacks) → `DwtAuth` / `DwtOnboarding` → **Outputs**.

Run **one command at a time**. After each, copy the one-line result into the Bruno var named in the heading.

**`tokenUrl`** — from signup success, or expect `https://….amazoncognito.com/oauth2/token` (never a host containing `…`)

```bash
aws cloudformation describe-stacks --stack-name DwtAuth \
  --query "Stacks[0].Outputs[?OutputKey=='TokenUrl'].OutputValue" --output text
```

**`clientId` / `clientSecret`** — from the signup success panel (preferred), or from the sandbox app client in the optional console section above.

In Bruno **dev**, add these variables:

| Name | From | What it is |
|---|---|---|
| `tokenUrl` | Signup result or `DwtAuth` output `TokenUrl` | Cognito `/oauth2/token` |
| `clientId` | Signup result or `DwtAuth` output `ClientId` | Cognito **app client** id (approved software) |
| `clientSecret` | Signup result (once) or Cognito **Show secret** | Paired with `clientId` for **Get token**. Not an API key |
| `token` | leave empty | **Get token** fills this software JWT |

Leave `apiBase`, `apiKey`, `movementId`, and `deliveryId` empty — those arrive in [step 07](../07-api-proving-path/README.md) when the waste API exists (operator key from [05b](../05b-operator-onboarding/README.md) or sandbox). Tick **Secret** for `clientSecret` if Bruno offers it. **Save**. Keep **dev** selected (not **No environment**).

You do **not** type the client id or secret into the **Get token** request itself. That request only references them as `{{clientId}}` and `{{clientSecret}}`.

### 5c. Request — Get token

Approved software proves who it is with `clientId` + `clientSecret` (HTTP Basic). The form body says “client credentials, scope `dwt/movements`.” Cognito replies with JSON that includes `access_token` — a signed string starting `eyJ…`. That ticket is the software, not the operator.

1. New request → name `Get token` → method **POST**.
2. URL: `{{tokenUrl}}` — Cognito `/oauth2/token`, not a `/movements` URL.
3. **Auth** → **Basic Auth** → username `{{clientId}}` → password `{{clientSecret}}`.
4. **Body** → **Form URL Encoded**:

   | Key | Value |
   |---|---|
   | `grant_type` | `client_credentials` |
   | `scope` | `dwt/movements` |

5. **Tests** tab — paste this **once** and leave it there:

   ```javascript
   const body = typeof res.getBody === "function" ? res.getBody() : res.body;
   const parsed = typeof body === "string" ? JSON.parse(body) : body;
   if (parsed && parsed.access_token) {
     bru.setEnvVar("token", parsed.access_token);
   }
   ```

6. **Send**. Expect **200**. The body has `access_token` (a long `eyJ…` string) and `expires_in` (usually `3600`). Confirm `dev` → `token` is now filled. Do not screenshot it.

**Success** looks like (do not paste this into chat):

```json
{
  "access_token": "eyJraWQiOiJ…",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

Nothing is written to AWS except Cognito issuing that ticket — no DynamoDB movements, no `/movements`. Decode the JWT at [jwt.io](https://jwt.io) *offline* — look for `scope`. Do not paste production tokens into random websites later.

| Status / symptom | Likely cause |
|---|---|
| **200** and `token` starts `eyJ` | Worked |
| `invalid_client` | Empty or wrong `clientId` / `clientSecret`, or **dev** not selected |
| `invalid_scope` | Scope is not exactly `dwt/movements` |
| DNS / could not resolve | `tokenUrl` still contains an ellipsis `…` copied from this README — use the CloudFormation output or signup result |
| **401** on a `/movements` URL | You created the wrong request. Stop. There is no waste API until step 07 |

`npm run learn -- 05` does **not** run Get token and does **not** require a pasted secret.

6. A request *without* this token will be 401 once the API exists (step 07).

## Alternative: Bruno or curl for `POST /software-providers`

If you are not running the UI, call the registration front door directly. This is the labelled alternative to the form, not the primary path.

```bash
export ONBOARDING_API_BASE=$(aws cloudformation describe-stacks --stack-name DwtOnboarding \
  --query "Stacks[0].Outputs[?OutputKey=='OnboardingApiBaseUrl'].OutputValue" --output text)

curl -sS -X POST "$ONBOARDING_API_BASE/software-providers" \
  -H 'content-type: application/json' \
  -d '{"productName":"Workshop Haulier Desk","contactEmail":"devex@example.com"}' | jq .
```

Expect **201** with `clientId`, `clientSecret`, and `tokenUrl`. Copy them into Bruno, then run **Get token** as above. Do not commit the secret.

## Alternative: curl for Get token

Same token exchange, no GUI. Skip this section if you already got a **200** in Bruno.

Set the three values in the **same** terminal (`CLIENT_ID` / `CLIENT_SECRET` from signup or the sandbox client, `TOKEN_URL` from the deploy output), then:

```bash
export CLIENT_ID='…'          # from signup or the app client page — do not copy this ellipsis
export CLIENT_SECRET='…'      # shown once at signup or Show client secret — do not commit
# Real URL from deploy output DwtAuth.TokenUrl — never a host containing …
export TOKEN_URL=$(aws cloudformation describe-stacks --stack-name DwtAuth \
  --query "Stacks[0].Outputs[?OutputKey=='TokenUrl'].OutputValue" --output text)
echo "TOKEN_URL set: $([ -n "$TOKEN_URL" ] && echo yes || echo NO)"

TOKEN=$(curl -sS -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d grant_type=client_credentials \
  -d scope=dwt/movements \
  "$TOKEN_URL")
echo "$TOKEN" | jq .
```

`TOKEN` is a **shell variable in this terminal only**. A new tab (after rotating keys, or after closing the window) starts empty — `echo "$TOKEN"` prints nothing and `jq` is silent. That is not Cognito failing. Re-export `CLIENT_ID` / `CLIENT_SECRET`, set `TOKEN_URL` from CloudFormation again, then run the `curl`. Use double quotes: `echo "$TOKEN"`. Single quotes (`echo '$TOKEN'`) print the word `$TOKEN`. Rotating the IAM key does not mint a JWT.

`echo "$TOKEN"` (quotes matter) is the **same JSON on one line**, not pretty-printed. A blank line means `TOKEN` was never set (wrong terminal, or curl not run). Do not paste it into chat.

If `jq` says parse error, the curl did not return JSON. Typical failures: empty `CLIENT_ID` / `CLIENT_SECRET` / `TOKEN_URL`; a `TOKEN_URL` that still contains an ellipsis `…`; wrong region; `invalid_client`; `invalid_scope`. `curl -s` hides errors — the commands above use `-sS` so DNS failures print.

`-u` is HTTP Basic auth (id:secret). Same grant and scope as the Bruno request.

## Automated check

After the deploys, a successful software-provider signup (form or curl), and a successful Get token (Bruno or curl):

```bash
npm run learn -- 05
```

The sandbox app client alone is enough to practise Get token, but this runner expects at least one self-registered provider in Cognito and DynamoDB (the primary path above).

### What the runner checks

- AWS credentials work and CloudFormation stacks `DwtAuth` and `DwtOnboarding` exist and are `*COMPLETE*`
- `DwtAuth` outputs include `UserPoolId` and `TokenUrl`; `DwtOnboarding` includes `SoftwareProvidersTableName`
- Pool `dwt-vendor-m2m` is readable and lists app clients, including sandbox `dwt-vendor-software`
- The SoftwareProviders table is active and has at least one `SOFTWARE#…` row whose `clientId` matches a Cognito app client named like `dwt-provider-…`
- CDK source declares `CreateUserPoolClient` for software-provider signup
- The `dwt-software-provider-signup` widget package exists

### What you do by hand

- Deploy `DwtAuth` and `DwtOnboarding`
- Run the signup form (or the Bruno/curl alternative), confirm the Cognito app client and DynamoDB row, and Get token
- The runner does **not** fetch a token and does **not** ask you to paste a secret

## Quiz

[`quiz.md`](quiz.md)

## Next

Step 05b: waste operator self sign-up (API key). Then step 06: DynamoDB ledger only — still no public movements HTTP.

## Save your work (GitHub)

From the **repo root** (`rubl/`). Why and what not to commit: [`learn/commit.md`](../../commit.md).

```bash
git status
git add -A
git status
git commit -m "learn: complete step 05 — auth and software provider onboarding"
git push
```

`nothing to commit` is fine if you only read. Do not commit `.env`, keys, or tokens.
