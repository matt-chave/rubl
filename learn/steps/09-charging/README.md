# Step 09 — Charging queue and operator ledger

## What is happening

The lake (step 08) already subscribed to **every** waste-movement event. Charging is a **second subscriber** on the same bus: only **chargeable** lifecycle types (`MOVEMENT_CREATED`, `WASTE_COLLECTED`, `DELIVERY_RECORDED`, `WASTE_RECEIVED`, and the receipt-only / legacy creates). Updates, deletes, and restores do **not** mint another fee.

```
Event bus dwt-waste-movements
  ├─► Kinesis → bronze / silver (step 08)     all events
  └─► SQS → charging Lambda → operator ledger  chargeable types only
```

The worker writes `PK=OPERATOR#<apiCode>`, `SK=PAYMENT#<eventId>` with amount **1** (placeholder tariff). The same `eventId` cannot be billed twice. If the Lambda throws, SQS retries five times, then the **DLQ** + CloudWatch alarm fire. `POST /movements` still returns **201**. That is the Billing bounded context rule: pay-to-play is not on the hot path.

The **£26 annual fee** is the same Billing context and the **same operator ledger** (`PK=OPERATOR#…`). It is a different *line*: incurred when a waste operator is onboarded, then once a year (`SK` something like `SUBSCRIPTION#2026`), not `PAYMENT#<eventId>`. Operator onboarding and GOV.UK Pay are **later** — they should write this table, not a second schema. This step only proves the per-event placeholder.

## Where the code is

The CloudFormation stack `DwtCharging` is [`infra/lib/stacks/charging-stack.ts`](../../../infra/lib/stacks/charging-stack.ts) (wired as `new ChargingStack(app, 'DwtCharging', { eventBus })` in [`infra/bin/app.ts`](../../../infra/bin/app.ts)). **Read that file before you deploy** — the comments are the explanation. CDK creates:

- Operator ledger DynamoDB — billing rows, not movements
- SQS queue + DLQ (`maxReceiveCount: 5`)
- EventBridge rule on the **existing** `dwt-waste-movements` bus (filter `detail.eventType`)
- Lambda [`src/lambdas/charging/index.ts`](../../../src/lambdas/charging/index.ts)
- CloudWatch alarm on DLQ depth

Do **not** click **Create queue** in [SQS](https://eu-west-2.console.aws.amazon.com/sqs/v3/home?region=eu-west-2#/queues) or **Create table** in [DynamoDB](https://eu-west-2.console.aws.amazon.com/dynamodbv2/home?region=eu-west-2#tables) first. This stack does not create the bus (step 08) or the API (step 07).

## Why this stack alone

If charging were inside `createMovement`, a billing outage would reject legal writes. Prove the queue and a `PAYMENT#` row after a 201, independently of the lake.

## Manual steps

Same order as 08: **read, deploy, POST, look, then the check**. Needs `DwtEvents` already deployed (the bus).

1. Open [`infra/lib/stacks/charging-stack.ts`](../../../infra/lib/stacks/charging-stack.ts) and walk ledger → DLQ → queue → rule → Lambda → alarm. There is no `PutEvents` from the API.
2. Reuse the same profile as step 05 if this is a new terminal, then deploy. CDK will ask about **IAM**. Type **`y`**.

```bash
export AWS_PROFILE=dwt-dev
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=eu-west-2
npx cdk deploy DwtCharging
```

3. **POST a movement** in **this** terminal so the new rule can see it. Events from before `DwtCharging` deployed will not be billed (the rule was not there). Same collect + token + curl as step 08.3. Expect **201**. Do not paste tokens or API keys into chat.

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
TOKEN=$(curl -sS -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d grant_type=client_credentials \
  -d scope=dwt/movements \
  "$TOKEN_URL" | jq -r .access_token)
curl -sS -D - -X POST "$API_BASE/movements" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  --data-binary @learn/fixtures/create-movement.json
```

4. [SQS → Queues](https://eu-west-2.console.aws.amazon.com/sqs/v3/home?region=eu-west-2#/queues) ([docs](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html)) — two queues (main + DLQ), CDK-hashed names. Open the **main** queue (not `Dlq`).

   **Available messages = 0 is success.** The Lambda usually eats the message in a second. You will not see a row sitting in **Send and receive messages**. Do not send a test message by hand.

   What to look at instead:

   - Queue **Monitoring** (or CloudWatch on that queue): **Number of messages sent** and **Number of messages deleted** should each tick up after the 201 (may take a minute to graph).
   - Step 5 — a `PAYMENT#` row in the operator ledger. That is the proof the queue worked.

```bash
aws cloudformation describe-stacks --stack-name DwtCharging \
  --query "Stacks[0].Outputs[?OutputKey=='ChargingQueueUrl' || OutputKey=='ChargingDlqUrl']" \
  --output table

# Depth should be 0 on a healthy worker:
aws sqs get-queue-attributes --queue-url "$(aws cloudformation describe-stacks --stack-name DwtCharging \
  --query "Stacks[0].Outputs[?OutputKey=='ChargingQueueUrl'].OutputValue" --output text)" \
  --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible \
  --output table
```

   If Monitoring never moved **and** step 5 is empty: the POST was before `DwtCharging` was `CREATE_COMPLETE`, or the EventBridge rule did not match. Repeat step 3.

5. **Look at the operator ledger** — this is the proof charging ran. Do **not** click **Create table**. This is **not** the movements table from step 06.

   Print the physical name (CDK hash — do not type it by hand):

```bash
LEDGER=$(aws cloudformation describe-stacks --stack-name DwtCharging \
  --query "Stacks[0].Outputs[?OutputKey=='OperatorLedgerTableName'].OutputValue" --output text)
echo "LEDGER=$LEDGER"
```

   You should see something like `DwtCharging-OperatorLedger…-…`.

   **Console:** [DynamoDB → Tables](https://eu-west-2.console.aws.amazon.com/dynamodbv2/home?region=eu-west-2#tables) ([docs](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/WorkingWithItems.html)) → click **that** name → **Explore table items** → **Run** (Scan). You are only reading.

   One row after the step 3 POST is enough. Expect:

   | Attribute | Looks like |
   |---|---|
   | `PK` | `OPERATOR#` then the fixture `apiCode` |
   | `SK` | `PAYMENT#` then a UUID (`eventId`) |
   | `eventType` | `MOVEMENT_CREATED` |
   | `publicId` | the `movementId` from the 201 (e.g. `26VAC8D4`) |
   | `amount` | `1` |

   **CLI** (same `$LEDGER`):

```bash
aws dynamodb scan --table-name "$LEDGER" --max-items 5 \
  --query 'Items[].{PK:PK.S,SK:SK.S,eventType:eventType.S,publicId:publicId.S,amount:amount.N}' \
  --output table
```

   Empty table: the worker has not written yet (wait a few seconds) or the POST was before `DwtCharging` existed — repeat step 3. Do not paste the scan into chat.

6. [CloudWatch → Alarms](https://eu-west-2.console.aws.amazon.com/cloudwatch/home?region=eu-west-2#alarmsV2:) ([docs](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html)) → charging DLQ alarm. State should be **OK** (no messages on the DLQ). You do **not** need to break charging to learn the isolation story: stopping this Lambda would still leave 201s working.

## Automated check

After the deploy and a POST:

```bash
npm run learn -- 09
```

## Quiz

[`quiz.md`](quiz.md)

## Save your work (GitHub)

From the **repo root** (`rubl/`). Why and what not to commit: [`learn/commit.md`](../../commit.md).

```bash
git status
git add -A
git status
git commit -m "learn: complete step 09 — charging"
git push
```

`nothing to commit` is fine if you only read. Do not commit `.env`, keys, or tokens.
