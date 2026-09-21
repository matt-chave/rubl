# Step 05 — Deploy Cognito and get a token (AWS `dev`)

## What is happening

Vendors are **machines**, not humans clicking a login page. They use OAuth2 **client credentials**: a `client_id` + `client_secret` exchanged for a JWT. API Gateway will later check that JWT *locally* (JWKS). Lambdas never call Cognito per movement — at 500M movements/year that would DDoS the IdP.

Cognito is a **stand-in** for Defra identity. Swapping the issuer later should not rewrite handlers.

## Why this stack alone

If auth is wrong, every later API test looks like a Lambda bug. Prove the token URL first.

## Automated check

```bash
export AWS_PROFILE=your-sandbox
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=eu-west-2

# first time in this account only:
npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/eu-west-2

npx cdk deploy DwtAuth
npm run learn -- 05
```

The check requires AWS credentials and a CloudFormation stack named `DwtAuth` with a User Pool.

## Manual steps

1. [Cognito → User pools](https://eu-west-2.console.aws.amazon.com/cognito/v2/idp/user-pools?region=eu-west-2) ([docs](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools.html)) → `dwt-vendor-m2m`. Find the **[app client](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-client-apps.html)**. Copy client id. Copy client secret into a password manager.
2. Stack outputs: `npx cdk deploy DwtAuth` prints `TokenUrl` and `OAuthScope` (`dwt/movements`).
3. Get a token:

```bash
TOKEN=$(curl -s -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d grant_type=client_credentials \
  -d scope=dwt/movements \
  "$TOKEN_URL")
echo "$TOKEN" | jq .
```

You should see `access_token` and `token_type: bearer`. Decode the JWT at [jwt.io](https://jwt.io) *offline* (or `jq` the payload) — look for `scope`. Do not paste production tokens into random websites later.

4. A request *without* this token will be 401 once the API exists (step 07).

## Quiz

[`quiz.md`](quiz.md)

## Next

Step 06: DynamoDB ledger only — still no public HTTP.
