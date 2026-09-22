# Step 08 — Event bus, Kinesis, bronze / silver lake

## What is happening

After DynamoDB stores an EVENT, a **Pipe** unmarshalls the stream image and puts a canonical envelope on bus `dwt-waste-movements`. A rule copies `detail` onto **Kinesis**. **Firehose** writes that JSON to S3 **bronze**. A later **Glue** job converts bronze → **silver Parquet**.

```
DynamoDB EVENT → Pipe + enrichment → EventBridge → Kinesis → Firehose → S3 bronze/ (JSON)
                                                                  ↘ Glue job → S3 silver/ (Parquet)
```

Firehose must **not** convert at ingest. The OpenAPI body evolves; a Glue schema at write time would send new records to `errors/` and you would lose the only copy. Bronze is the durable landing zone. Silver is rebuildable.

Firehose buffers (up to 60s / 1 MiB). The API 201 you already saw will not have a bronze object *immediately*. That is eventual consistency, not a bug. Silver does not appear until you run the Glue job.

## Where the code is

The CloudFormation stack `DwtEvents` is [`infra/lib/stacks/events-stack.ts`](../../../infra/lib/stacks/events-stack.ts) (wired as `new EventsStack(app, 'DwtEvents', …)` in [`infra/bin/app.ts`](../../../infra/bin/app.ts)). **Read that file before you deploy** — the comments are the explanation. The lake layers live in [`infra/lib/constructs/movement-lake.ts`](../../../infra/lib/constructs/movement-lake.ts) and [`infra/glue/bronze_to_silver.py`](../../../infra/glue/bronze_to_silver.py).

Do **not** click **Create event bus** in [EventBridge](https://eu-west-2.console.aws.amazon.com/events/home?region=eu-west-2#/eventbuses) ([docs](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-bus.html)) first. This stack does not create tables or the API.

## Why this stack alone

If the lake is wrong, you still have a legal EVENT in DynamoDB. Prove the bus and bronze landing zone before charging (step 09). Silver is optional for the automated check.

## Manual steps

Deploy first, then wait for bronze, then convert to silver, then the check.

1. Open [`infra/lib/stacks/events-stack.ts`](../../../infra/lib/stacks/events-stack.ts) and walk Pipe → bus → Kinesis → bronze Firehose → silver job.
2. Reuse the same profile as step 05 if this is a new terminal, then deploy. CDK will ask about **IAM** (Pipe, Firehose, Glue). That is expected — type **`y`**.

```bash
export AWS_PROFILE=dwt-dev
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=eu-west-2
npx cdk deploy DwtEvents
```

If deploy fails with **The AWS Access Key Id needs a subscription for the service (Service: Kinesis)**, or the [Kinesis console](https://eu-west-2.console.aws.amazon.com/kinesis/home?region=eu-west-2#/streams/list) sends you to **Complete registration**: you are not configuring Kinesis. AWS is finishing (or upgrading) the **account**. Sign in as the [root user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_root-user.html) (the email that created the account), not the IAM user `dwt-dev` uses.

   New **Free plan** accounts ([docs](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-plans.html)): [Kinesis Data Streams](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html) is only on the **Paid** plan. That plan is pay-as-you-go, not a Kinesis product. [Upgrade](https://docs.aws.amazon.com/accounts/latest/reference/upgrade-account.html): open [AWS Settings → Billing](https://settings.aws.com) → **Upgrade** → **Get started** → add a payment method → **Upgrade account**. Or use **Upgrade plan** on the console home. Set a [spend limit](https://docs.aws.amazon.com/accounts/latest/reference/spend-limits.html) if offered.

   Older signup / **Your service sign-up is almost complete** ([docs](https://docs.aws.amazon.com/SetUp/latest/UserGuide/setup-troubleshooting.html)): add a payment method (AWS may hold about $1 to verify the card), verify the phone by SMS, pick **Basic** support (free — not Developer/Business). **Complete sign up**. Activation can take a few minutes (rarely up to 24 hours). Email confirms it.

   Do not paste card numbers, OTPs, or account ids into chat. Then open [Kinesis Data streams](https://eu-west-2.console.aws.amazon.com/kinesis/home?region=eu-west-2#/streams/list) again — you want the stream **list**, not registration. When `aws cloudformation describe-stacks --stack-name DwtEvents --query Stacks[0].StackStatus --output text` is `ROLLBACK_COMPLETE`, run `npx cdk deploy DwtEvents` again.

3. **POST a movement** in **this** terminal so the new Pipe / Firehose can see it. Events written before `DwtEvents` deployed will not appear in bronze (the Pipe reads the stream from `LATEST`). Same profile as step 2. Do not paste tokens or API keys into chat.

   Collect the API values (silent on success until the `echo`):

```bash
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

   Mint a JWT, then POST the fixture:

```bash
TOKEN=$(curl -sS -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d grant_type=client_credentials \
  -d scope=dwt/movements \
  "$TOKEN_URL" | jq -r .access_token)
echo "TOKEN set: $([ -n "$TOKEN" ] && echo yes || echo NO)"

curl -sS -D - -X POST "$API_BASE/movements" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  --data-binary @learn/fixtures/create-movement.json
```

   Expect HTTP **201** and a `movementId`. Then wait **2 minutes** for Firehose to flush bronze.

4. **Look at the bus** — do **not** click **Create event bus**. CDK already made `dwt-waste-movements`. You are only checking it is there and that a rule points at Kinesis.

   [EventBridge → Event buses](https://eu-west-2.console.aws.amazon.com/events/home?region=eu-west-2#/eventbuses) ([docs](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-bus.html)) → click **`dwt-waste-movements`** (custom, not `default`) → tab **Rules**. You should see one rule whose target is the Kinesis stream. Same check in the terminal:

```bash
aws events list-rules --event-bus-name dwt-waste-movements --output table
```

   Expect a rule name (CDK hash, often containing `ToKinesis`). Empty list means the stack did not finish — go back to step 2.

5. **Look at the stream** — do **not** click **Create data stream**. Open [Kinesis → Data streams](https://eu-west-2.console.aws.amazon.com/kinesis/home?region=eu-west-2#/streams/list) ([docs](https://docs.aws.amazon.com/streams/latest/dev/introduction.html)) → **`dwt-waste-movements`**. Status should be **Active**, **1** shard. You will **not** see individual movement JSON here in a friendly table — Kinesis is a buffer, not a file browser. Done when the stream exists and is Active:

```bash
aws kinesis describe-stream-summary --stream-name dwt-waste-movements \
  --query 'StreamDescriptionSummary.{Name:StreamName,Status:StreamStatus,Shards:OpenShardCount}' \
  --output table
```

   If this page is **Complete registration** again, finish the account steps under step 2 first.

6. **Look at bronze on S3** — this is the first place you *read* an event. Do **not** create a bucket. The name is a CDK hash; use the stack output, do not type it.

```bash
BUCKET=$(aws cloudformation describe-stacks --stack-name DwtEvents \
  --query "Stacks[0].Outputs[?OutputKey=='LakeBucketName'].OutputValue" --output text)
echo "BUCKET set: $([ -n "$BUCKET" ] && echo yes || echo NO)"
aws s3 ls "s3://$BUCKET/bronze/events/" --recursive
aws s3 ls "s3://$BUCKET/bronze/errors/" --recursive
```

   [S3](https://s3.console.aws.amazon.com/s3/home?region=eu-west-2) ([docs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html)) → open that same bucket name → folder `bronze` → `events` → year/month/day. Empty after a 201: wait another minute, or you POSTed before `DwtEvents` was `CREATE_COMPLETE` — repeat step 3.

   When a file appears, download it (or print it). It is **JSON lines** — one envelope per line:

```bash
KEY=$(aws s3 ls "s3://$BUCKET/bronze/events/" --recursive | awk '{print $4}' | tail -n 1)
aws s3 cp "s3://$BUCKET/$KEY" - | head -n 1
```

   You should see `"eventType"` and `"payload": {` (an **object**). `"payload": "{` (a string) would be the old design. Anything under `bronze/errors/` is a Firehose **delivery** failure (IAM / stream), not a Parquet schema error.

7. Convert bronze → silver from **this terminal**. `cdk deploy` already **created** the Glue job (`dwt-bronze-to-silver`). You are not creating it. `start-job-run` **starts** that existing job once. Do **not** click **Create job** in the console.

   Only do this after step 6 listed at least one object under `bronze/events/`. An empty bronze prefix makes the job fail and still bills a short Spark run (2 × G.1X, timeout 20 min).

```bash
JOB=$(aws cloudformation describe-stacks --stack-name DwtEvents \
  --query "Stacks[0].Outputs[?OutputKey=='SilverJobName'].OutputValue" --output text)
echo "JOB=$JOB"
aws glue start-job-run --job-name "$JOB"
```

   Expect JSON with a `JobRunId`. That means the run has started. Optional: watch [Glue → ETL jobs](https://eu-west-2.console.aws.amazon.com/gluestudio/home?region=eu-west-2#/jobs) ([docs](https://docs.aws.amazon.com/glue/latest/dg/aws-glue-programming-intro.html)) until **Succeeded**, or poll:

```bash
aws glue get-job-runs --job-name "$JOB" --max-items 1 \
  --query 'JobRuns[0].{Id:Id,State:JobRunState}' --output table
```

   When the state is `SUCCEEDED`:

```bash
aws s3 ls "s3://$BUCKET/silver/events/" --recursive
```

8. Optional: query silver in [Athena](https://eu-west-2.console.aws.amazon.com/athena/home?region=eu-west-2#/query-editor) ([getting started](https://docs.aws.amazon.com/athena/latest/ug/getting-started.html)). You are not creating a table. The Glue job already registered `dwt_lake.silver_waste_movement_events`. Athena still needs an S3 folder to **write its own result files** (CSV of what you queried). That is separate from `bronze/` and `silver/`.

   **One-time setup** (same `$BUCKET` as step 6). Create the folder, then point Athena at it ([result location](https://docs.aws.amazon.com/athena/latest/ug/query-results-specify-location-console.html)):

```bash
aws s3api put-object --bucket "$BUCKET" --key athena-results/
echo "s3://$BUCKET/athena-results/"
```

   Copy that `s3://…/athena-results/` line. Then:

   1. Open the [query editor](https://eu-west-2.console.aws.amazon.com/athena/home?region=eu-west-2#/query-editor). Region **eu-west-2**. Workgroup top right should be **primary**.
   2. If a banner says you must set a query result location, click it. Otherwise **Settings** (gear) → **Manage**.
   3. **Location of query result**: paste `s3://YOUR_BUCKET/athena-results/` (trailing slash). Or **Browse S3** → the lake bucket from step 6 → folder `athena-results` → **Choose**. Save.
   4. Left **Data** pane: **Data source** `AwsDataCatalog` → **Database** `dwt_lake`. You should see table `silver_waste_movement_events`. If the database is missing, the Glue job has not succeeded yet.
   5. Paste a statement below into the editor → **Run**. Results appear under the editor. Do not paste those rows into chat.

   After this, skip the banner next time. Go straight to **Run**.

```sql
SHOW TABLES IN dwt_lake;

DESCRIBE dwt_lake.silver_waste_movement_events;
```

   Envelope only (quote camelCase names if Athena says the column cannot be resolved):

```sql
SELECT
  "eventType",
  "eventId",
  "occurredAt",
  "publicId",
  "apiCode"
FROM dwt_lake.silver_waste_movement_events
LIMIT 20;
```

```sql
SELECT "eventType", COUNT(*) AS n
FROM dwt_lake.silver_waste_movement_events
GROUP BY 1;
```

   Nested `payload` (same object as the POST body). After a step 3 create you should see the fixture producer name:

```sql
SELECT
  "eventType",
  "publicId",
  payload.producer.organisationName,
  payload.plannedCollectionTime
FROM dwt_lake.silver_waste_movement_events
WHERE "eventType" = 'MOVEMENT_CREATED'
LIMIT 10;
```

   Empty result: the Glue job has not succeeded yet, or you queried before silver existed. Re-run `DESCRIBE`. Do not paste query result rows into chat (the fixture includes emails).

## Automated check

After the deploy (bronze can still be catching up; silver can still be unrun):

```bash
npm run learn -- 08
```

## Quiz

[`quiz.md`](quiz.md)

## Save your work (GitHub)

From the **repo root** (`rubl/`). Why and what not to commit: [`learn/commit.md`](../../commit.md).

```bash
git status
git add -A
git status
git commit -m "learn: complete step 08 — events lake"
git push
```

`nothing to commit` is fine if you only read. Do not commit `.env`, keys, or tokens.
