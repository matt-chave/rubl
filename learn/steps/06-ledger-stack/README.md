# Step 06 — Deploy the movements ledger (AWS `dev`)

## What is happening

The **Core Movements Ledger** is DynamoDB tables CDK creates for you:

- **Movements** — `EVENT#…` append-only rows plus a `CURRENT` snapshot. Stream `NEW_IMAGE` (used in step 08).
- **History** — copy of `CURRENT` before a PUT (the spec’s “snapshot then revise”).
- **Sequences** — atomic counters that feed sqids.
- **Reference** — unused in this slice.

We do **not** `UpdateItem` on events. DynamoDB can overwrite; we refuse to, so the legal trail stays an append-only log.

## Where the code is

The CloudFormation stack `DwtLedger` is [`infra/lib/stacks/ledger-stack.ts`](../../../infra/lib/stacks/ledger-stack.ts) (wired as `new LedgerStack(app, 'DwtLedger', …)` in [`infra/bin/app.ts`](../../../infra/bin/app.ts)). **Read that file before you deploy** — the comments are the explanation. CDK creates empty tables:

- **Movements** — PK/SK items: `EVENT#…` (append-only facts) and `CURRENT` (latest snapshot). Stream `NEW_IMAGE` so step 08 can publish *after* a durable write.
- **History** — copy of `CURRENT` taken before a PUT revises it.
- **Sequences** — atomic counters that mint year-prefixed sqids.
- **Reference** — unused placeholder in this slice.

Do **not** click **Create table** in [DynamoDB → Tables](https://eu-west-2.console.aws.amazon.com/dynamodbv2/home?region=eu-west-2#tables) first. This stack is the **shape** of the ledger, not the movements themselves. Application writes live in [`src/lib/ledger.ts`](../../../src/lib/ledger.ts) and run from Lambdas in step 07.

## Why this stack alone

If the ledger is wrong, every later API 201 looks like a handler bug. Prove the tables (and the stream) exist before HTTP.

## Manual steps

Same order as step 05: **read, deploy, look, then the check**. Reuse the `AWS_PROFILE` / `CDK_DEFAULT_*` exports if this is a new terminal.

1. Open [`infra/lib/stacks/ledger-stack.ts`](../../../infra/lib/stacks/ledger-stack.ts) and walk the four tables against the comments. There is no `PutItem` of a real movement here.
2. `npx cdk deploy DwtLedger`
3. [DynamoDB → Tables](https://eu-west-2.console.aws.amazon.com/dynamodbv2/home?region=eu-west-2#tables) ([docs](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/WorkingWithTables.html)). The physical name looks like `DwtLedger-MovementsD0022A57-1FIV79GK7JKHT` — that is CDK, not a mistake. Construct id is `Movements`; we did not set `tableName`, so CloudFormation appends a hash so two sandboxes cannot clash. Open that table → **Indexes** / key schema: **PK** and **SK** are both **String**. DynamoDB does not know about `MOVEMENT#` or `CURRENT` — those prefixes are a convention in [`src/lib/ledger.ts`](../../../src/lib/ledger.ts). On an empty table you will **not** see `EVENT#` values yet. After the PutItem below, **Explore table items** should show `PK=LEARN#ping`, `SK=CURRENT`. The CLI uses stack output `MovementsTableName` so you never type the hash.
4. Use AWS CLI to put a **throwaway** item, then delete it — feel `PutItem`:

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

5. Confirm the **movements** table has a [DynamoDB stream](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.html). History / sequences will not.

   **Console:** same [tables list](https://eu-west-2.console.aws.amazon.com/dynamodbv2/home?region=eu-west-2#tables) → open the `DwtLedger-Movements…` table → tab **Exports and streams** (sometimes **Exports and Streams**). Under **DynamoDB stream details** you want **Stream enabled** (or status **Enabled**) and view type **New image** (`NEW_IMAGE`). You do **not** need to see records yet — enabling the stream is enough. Step 08’s Pipe reads this.

   **CLI** (same `$TABLE` as step 4):

   ```bash
   aws dynamodb describe-table --table-name "$TABLE" \
     --query 'Table.{StreamEnabled:StreamSpecification.StreamEnabled,View:StreamSpecification.StreamViewType,Arn:LatestStreamArn}' \
     --output table
   ```

   Expect `StreamEnabled` `True` and `View` `NEW_IMAGE`. The ARN is also stack output `MovementsTableStreamArn` from `cdk deploy DwtLedger`.


## Automated check

After the deploy and the PutItem above:

```bash
npm run learn -- 06
```

## Quiz

[`quiz.md`](quiz.md)

## Save your work (GitHub)

From the **repo root** (`rubl/`). Why and what not to commit: [`learn/commit.md`](../../commit.md).

```bash
git status
git add -A
git status
git commit -m "learn: complete step 06 — ledger stack"
git push
```

`nothing to commit` is fine if you only read. Do not commit `.env`, keys, or tokens.
