# Step 05b — Waste operator self sign-up (AWS `dev`)

## What is happening

The onboarding team’s second front door registers a **waste operator**. The operator is not a Cognito user and not an AWS account. Signup captures organisation name, address, and contact email, stores a profile on the `Operators` table in `DwtOnboarding`, creates an API Gateway API key, attaches it to usage plan `dwt-operators`, and returns the key value **once** with `operatorId`. The key value is not stored.

This is still not the movements API. The key cannot call `POST /movements` until `DwtApi` is deployed in [step 07](../07-api-proving-path/README.md) and that lesson attaches the onboarding usage plan to the movements API stage (alongside the sandbox key). Movements Lambdas resolve `apiKeyId` from the Operators table; they do not HTTP-call onboarding on each POST.

There is still no pairing grant. Any approved software JWT plus a valid operator key may submit once the movements API exists. GOV.UK One Login, permits, and exemptions stay later.

## Where the code is

- Stack: [`infra/lib/stacks/onboarding-stack.ts`](../../../infra/lib/stacks/onboarding-stack.ts) — `POST /operators`, Operators table, usage plan `dwt-operators` ([API keys](https://eu-west-2.console.aws.amazon.com/apigateway/main/api-keys?region=eu-west-2), [usage plans](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-key-usage-plans.html), [docs](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-key-usage-plans.html))
- Lambda: [`src/lambdas/createOperator`](../../../src/lambdas/createOperator) → [`src/lib/operations/operators.ts`](../../../src/lib/operations/operators.ts)
- Identity lookup: [`src/lib/identity.ts`](../../../src/lib/identity.ts) — sandbox key → `OP-SANDBOX-1`; other keys → Operators table by `apiKeyId`
- Widget: `dwt-operator-signup` in [`packages/dwt-mfe-operator-signup`](../../../packages/dwt-mfe-operator-signup)
- Host: [`apps/dwt-onboarding-ui`](../../../apps/dwt-onboarding-ui) (same app as lesson 5; choose operator registration)
- BFF: `POST /bff/operators` in [`apps/dwt-bff`](../../../apps/dwt-bff)

DynamoDB console for the Operators table: [DynamoDB tables](https://eu-west-2.console.aws.amazon.com/dynamodbv2/home?region=eu-west-2#tables) ([docs](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)).

## Why this step alone

Software credentials without an operator key cannot prove the dual-identity edge. Issuing the key here, before the ledger and movements API, keeps onboarding with the team that owns it.

## Manual steps

Gate: step 05 complete (`DwtAuth` and `DwtOnboarding` already deployed).

1. Confirm `ONBOARDING_API_BASE` in `apps/dwt-bff/.env.local` (from lesson 5). If needed:

   ```bash
   export AWS_PROFILE=dwt-dev
   export AWS_DEFAULT_REGION=eu-west-2
   aws cloudformation describe-stacks --stack-name DwtOnboarding \
     --query "Stacks[0].Outputs[?OutputKey=='OnboardingApiBaseUrl'].OutputValue" --output text
   ```

2. Primary path — operator signup form:

   ```bash
   npm run bff
   npm run onboarding-ui
   ```

   Open [http://127.0.0.1:5174](http://127.0.0.1:5174), choose **Register as a waste operator**, submit organisation name, address, and contact email. The host shows `operatorId` and the API key once. Copy the key into a password manager and into Bruno `dev` → `apiKey` when you reach step 07. Do not put the key in widget source or git.

3. Optional console look: [API Gateway → API keys](https://eu-west-2.console.aws.amazon.com/apigateway/main/api-keys?region=eu-west-2) should list a key named like `dwt-operator-op-…` on plan `dwt-operators`. You will not see the key value again after creation.

## Alternative: Bruno or curl for `POST /operators`

```bash
export ONBOARDING_API_BASE=$(aws cloudformation describe-stacks --stack-name DwtOnboarding \
  --query "Stacks[0].Outputs[?OutputKey=='OnboardingApiBaseUrl'].OutputValue" --output text)

curl -sS -X POST "$ONBOARDING_API_BASE/operators" \
  -H 'content-type: application/json' \
  -d '{"organisationName":"Acme Waste Ltd","address":"1 Depot Road, London","contactEmail":"ops@acme.example"}' | jq .
```

Expect **201** with `operatorId` and `apiKey`. Store the key; do not commit it.

## Automated check

```bash
npm run learn -- 05b
```

### What the runner checks

- `DwtOnboarding` is deployed and outputs include `OperatorsTableName` and `OperatorsUsagePlanId`
- CDK / source declares operator signup, usage plan `dwt-operators`, and Operators table
- `identity.ts` resolves non-sandbox keys via the Operators table
- The `dwt-operator-signup` widget package exists

### What you do by hand

- Run the operator signup form (or Bruno/curl)
- Copy the API key somewhere safe
- The runner does **not** require a pasted key value

## Quiz

[`quiz.md`](quiz.md)

## Next

Step 06: DynamoDB ledger. Step 07 attaches `dwt-operators` to the movements API so this key (or the sandbox key) can call `POST /movements`.

## Save your work (GitHub)

From the **repo root** (`rubl/`). Why and what not to commit: [`learn/commit.md`](../../commit.md).

```bash
git status
git add -A
git status
git commit -m "learn: complete step 05b — operator onboarding"
git push
```

Do not commit `.env`, API keys, or tokens.
