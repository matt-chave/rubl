# Step 09 — Charging queue and operator ledger

## What is happening

A second EventBridge rule matches **chargeable** types only (`MOVEMENT_CREATED`, `WASTE_COLLECTED`, …) and sends them to **SQS**. A Lambda writes `PK=OPERATOR#<apiCode>`, `SK=PAYMENT#<eventId>`.

If this Lambda throws, SQS retries, then the **DLQ** + CloudWatch alarm fire. `POST /movements` is unaffected. That is the Billing bounded context rule: pay-to-play is not on the hot path.

Amount is a **placeholder** (1 unit). Idempotency is the payment SK: a replay of the same `eventId` does not double-charge.

## Manual steps

Deploy first, then look at the queue, then the check.

1. `npx cdk deploy DwtCharging`

2. POST another movement (step 07).
3. [SQS → Queues](https://eu-west-2.console.aws.amazon.com/sqs/v3/home?region=eu-west-2#/queues) ([docs](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html)) → charging queue → monitoring (messages in / out).
4. [DynamoDB → Tables](https://eu-west-2.console.aws.amazon.com/dynamodbv2/home?region=eu-west-2#tables) → operator ledger table. Look for `PAYMENT#…`.
5. [CloudWatch → Alarms](https://eu-west-2.console.aws.amazon.com/cloudwatch/home?region=eu-west-2#alarmsV2:) ([docs](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html)) → charging DLQ. It should be OK.
6. To *see* the isolation story: you do **not** need to break charging. Remember: stopping this Lambda would still leave 201s working.

```bash
LEDGER=$(aws cloudformation describe-stacks --stack-name DwtCharging \
  --query "Stacks[0].Outputs[?OutputKey=='OperatorLedgerTableName'].OutputValue" --output text)
aws dynamodb scan --table-name "$LEDGER" --max-items 5
```

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
