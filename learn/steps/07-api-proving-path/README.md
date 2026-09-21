# Step 07 — API + POST /movements (proving path)

## What is happening

This is the first **end-to-end write** a vendor will do:

1. JWT from Cognito (step 05)
2. `x-api-key` from Secrets Manager (stack output `ApiKeySecretArn`)
3. `POST /dwt/movements` with [`learn/fixtures/create-movement.json`](../../fixtures/create-movement.json)
4. Lambda validates, mints a sqid, `PutItem` EVENT + CURRENT
5. 201 `{ movementId, validation: { warnings } }`

Lake and charging are **not** required for this HTTP success. That is the point of EDA: ingestion is complete when DynamoDB has the event.

## Automated check

```bash
npx cdk deploy DwtApi
# DwtApi depends on Auth + Ledger already being deployed
npm run learn -- 07
```

The check confirms the stack is `CREATE/UPDATE_COMPLETE` and the REST API exists.

## Manual steps (this is the important one)

1. Collect outputs:

```bash
API_BASE=$(aws cloudformation describe-stacks --stack-name DwtApi \
  --query "Stacks[0].Outputs[?OutputKey=='ApiBaseUrl'].OutputValue" --output text)
SECRET_ARN=$(aws cloudformation describe-stacks --stack-name DwtApi \
  --query "Stacks[0].Outputs[?OutputKey=='ApiKeySecretArn'].OutputValue" --output text)
API_KEY=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" --query SecretString --output text)
TOKEN_URL=$(aws cloudformation describe-stacks --stack-name DwtAuth \
  --query "Stacks[0].Outputs[?OutputKey=='TokenUrl'].OutputValue" --output text)
```

2. Get `TOKEN` as in step 05.

3. **Happy path**

```bash
curl -sS -D - -X POST "$API_BASE/movements" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  --data-binary @learn/fixtures/create-movement.json
```

Expect `201` and a `movementId`. Copy it.

4. **Auth failures (learn the edge)**

- Omit `Authorization` → 401
- Omit `x-api-key` → 403
- Send `{}` as the body with both credentials → 400 and `validation.errors` with `NotProvided`

5. [DynamoDB → Tables](https://eu-west-2.console.aws.amazon.com/dynamodbv2/home?region=eu-west-2#tables) → movements table → **Explore table items**. You should see `PK=MOVEMENT#<id>`, `SK=CURRENT` and an `EVENT#…` row.

6. Optional GUI: import the same URL into [Bruno](https://www.usebruno.com/) or Postman with the two headers.

## Quiz

[`quiz.md`](quiz.md)
