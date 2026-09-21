# Step 06 — Deploy the movements ledger (AWS `dev`)

## What is happening

The **Core Movements Ledger** is three DynamoDB tables:

- **Movements** — `EVENT#…` append-only rows plus a `CURRENT` snapshot. Stream `NEW_IMAGE` (used in step 08).
- **History** — copy of `CURRENT` before a PUT (the spec’s “snapshot then revise”).
- **Sequences** — atomic counters that feed sqids.

We do **not** `UpdateItem` on events. DynamoDB can overwrite; we refuse to, so the legal trail stays an append-only log.

## Automated check

```bash
npx cdk deploy DwtLedger
npm run learn -- 06
```

## Manual steps

1. [DynamoDB → Tables](https://eu-west-2.console.aws.amazon.com/dynamodbv2/home?region=eu-west-2#tables) ([docs](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/WorkingWithTables.html)). Open the movements table. Note PK / SK.
2. Use AWS CLI to put a **throwaway** item, then delete it — feel `PutItem`:

```bash
TABLE=$(aws cloudformation describe-stacks --stack-name DwtLedger \
  --query "Stacks[0].Outputs[?OutputKey=='MovementsTableName'].OutputValue" --output text)

aws dynamodb put-item --table-name "$TABLE" --item '{
  "PK": {"S": "LEARN#ping"},
  "SK": {"S": "CURRENT"},
  "note": {"S": "delete me"}
}'

aws dynamodb get-item --table-name "$TABLE" --key '{
  "PK": {"S": "LEARN#ping"},
  "SK": {"S": "CURRENT"}
}'

aws dynamodb delete-item --table-name "$TABLE" --key '{
  "PK": {"S": "LEARN#ping"},
  "SK": {"S": "CURRENT"}
}'
```

3. Confirm the table has a **[stream](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.html)** (table → **Exports and streams** in the same console). Step 08 depends on it.

## Quiz

[`quiz.md`](quiz.md)
