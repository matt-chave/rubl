# Step 05 — Deploy Cognito and get a token (AWS `dev`)

## What is happening

Vendors are **machines**, not humans clicking a login page. They use OAuth2 **client credentials**: a `client_id` + `client_secret` exchanged for a JWT. API Gateway will later check that JWT *locally* (JWKS). Lambdas never call Cognito per movement — at 500M movements/year that would DDoS the IdP.

Cognito is a **stand-in** for Defra identity. Swapping the issuer later should not rewrite handlers.

## JWT vs API key

A **[JWT](https://jwt.io/introduction)** (JSON Web Token) is a short-lived **signed** string (`header.payload.signature`). Cognito issues it in step 4. Later, API Gateway checks the signature locally ([JWKS](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html)) — “this software is allowed, until `exp`.” It is **not** an API key.

An **[API key](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-key-source.html)** is a separate long-lived string on API Gateway (`x-api-key`). It is for **usage plans** (throttle / quota / revoke one caller). You do not have one yet; it arrives in step 07. The API will require **both**: `Authorization: Bearer <JWT>` and `x-api-key`.

The `client_id` + `client_secret` from step 3 are also not the API key. They are the vendor software’s password to **ask Cognito for a JWT**. You do not send the secret on every `POST /movements`.

## Where the code is

The CloudFormation stack `DwtAuth` is [`infra/lib/stacks/auth-stack.ts`](../../../infra/lib/stacks/auth-stack.ts) (wired as `new AuthStack(app, 'DwtAuth', …)` in [`infra/bin/app.ts`](../../../infra/bin/app.ts)). **Read that file before you deploy** — the comments are the explanation. CDK creates:

- User Pool `dwt-vendor-m2m` — the **type** (machine-vendor identity store; no Cognito *users*; `selfSignUpEnabled` is false)
- Resource server scope `dwt/movements` — what that type of caller may request
- App client `dwt-vendor-software` — **one** sandbox vendor (`client_id` + secret, client-credentials only) so you can prove the token URL. A new real vendor must **not** mean another `cdk deploy DwtAuth`. Production IAM creates clients via the Cognito API (often after a DevEx conformance event), same pool, same scope. The API key in `DwtApi` is the same sandbox shortcut.
- Hosted domain so `/oauth2/token` exists

Do **not** click **Create user pool** or **Create user** in the [Cognito console](https://eu-west-2.console.aws.amazon.com/cognito/v2/idp/user-pools?region=eu-west-2) first. An empty list is expected.

## Why this stack alone

If auth is wrong, every later API test looks like a Lambda bug. Prove the token URL first.

## Manual steps

Do these **in order**. You need the deploy (profile, bootstrap, `cdk deploy`) **before** the console and curl. `npm run learn -- 05` is last — that is the green tick, not the deploy.

1. Open [`infra/lib/stacks/auth-stack.ts`](../../../infra/lib/stacks/auth-stack.ts) and walk the constructs against the comments (pool → scope → app client → domain). There is no `CognitoUser`.
2. In a terminal (keep it open):

```bash
# profile name from step 04 — not an account number, not the IAM user name
export AWS_PROFILE=dwt-dev
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=eu-west-2

# first time in this account only:
npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/eu-west-2

npx cdk deploy DwtAuth
```

The deploy prints `TokenUrl` and `OAuthScope` (`dwt/movements`). Do not deploy again unless you changed the stack.

3. Client id and secret — after deploy, **not** from Users:

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

4. Prove the issuer: exchange the app client’s `client_id` + `client_secret` for a JWT (OAuth2 **client credentials**). This is **not** a waste-API call — there is no `/movements` yet. Set the three values in the **same** terminal (`CLIENT_ID` / `CLIENT_SECRET` from step 3, `TOKEN_URL` from the deploy output), then:

```bash
export CLIENT_ID='…'          # from the app client page — do not copy this ellipsis
export CLIENT_SECRET='…'      # Show client secret — do not commit
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


**Success** looks like pretty-printed JSON (do not paste this into chat):

```json
{
  "access_token": "eyJraWQiOiJ…",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

`access_token` is the JWT (a long `eyJ…` string with two dots). `expires_in` is seconds (often 3600). Nothing is written to AWS except Cognito issuing that ticket — no DynamoDB, no `/movements`.

`echo "$TOKEN"` (quotes matter) is the **same JSON on one line**, not pretty-printed. Use quotes so the shell does not split it. A blank line means `TOKEN` was never set (wrong terminal, or curl not run). Do not paste it into chat.

If `jq` says parse error, the curl did not return JSON. Run `echo "$TOKEN"` (still do not paste it here). Typical failures: empty `CLIENT_ID` / `CLIENT_SECRET` / `TOKEN_URL`; a `TOKEN_URL` that still contains an ellipsis `…` copied from this README; wrong region; `invalid_client`; `invalid_scope` if the scope is not exactly `dwt/movements`. `curl -s` hides errors — the commands above use `-sS` so DNS failures print.

`-u` is HTTP Basic auth (id:secret). The form body asks Cognito for grant `client_credentials` and scope `dwt/movements`. Decode the JWT at [jwt.io](https://jwt.io) *offline* (or `jq` the payload) — look for `scope`. Do not paste production tokens into random websites later. `npm run learn -- 05` does **not** run this curl.


5. A request *without* this token will be 401 once the API exists (step 07).

## Automated check

After the deploy and curl above:

```bash
npm run learn -- 05
```

Requires AWS credentials and a CloudFormation stack named `DwtAuth` with a User Pool. It does **not** fetch a token — that was the curl.

## Quiz

[`quiz.md`](quiz.md)

## Next

Step 06: DynamoDB ledger only — still no public HTTP.

## Save your work (GitHub)

From the **repo root** (`rubl/`). Why and what not to commit: [`learn/commit.md`](../../commit.md).

```bash
git status
git add -A
git status
git commit -m "learn: complete step 05 — auth stack"
git push
```

`nothing to commit` is fine if you only read. Do not commit `.env`, keys, or tokens.
