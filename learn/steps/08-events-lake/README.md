# Step 08 — Event bus, Kinesis, Parquet lake

## What is happening

After DynamoDB stores an EVENT, a **Pipe** unmarshalls the stream image and puts a canonical envelope on bus `dwt-waste-movements`. A rule copies `detail` onto **Kinesis**. **Firehose** converts JSON → **Parquet** using a Glue table and writes to S3.

```
DynamoDB EVENT → Pipe + enrichment → EventBridge → Kinesis → Firehose → S3
```

Firehose buffers (up to 60s / 64 MiB). The API 201 you already saw will not have an S3 object *immediately*. That is eventual consistency, not a bug.

`payload` in Parquet is a **string** so the Glue schema stays flat when OpenAPI evolves.

## Automated check

```bash
npx cdk deploy DwtEvents
npm run learn -- 08
```

## Manual steps

1. After a new `POST /movements` (step 07), wait **2 minutes**.
2. [EventBridge → Event buses](https://eu-west-2.console.aws.amazon.com/events/home?region=eu-west-2#/eventbuses) ([docs](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-bus.html)) → `dwt-waste-movements` → rules.
3. [Kinesis → Data streams](https://eu-west-2.console.aws.amazon.com/kinesis/home?region=eu-west-2#/streams/list) ([docs](https://docs.aws.amazon.com/streams/latest/dev/introduction.html)) → `dwt-waste-movements`.
4. [S3](https://s3.console.aws.amazon.com/s3/home?region=eu-west-2) ([docs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html)) → lake bucket (stack output `LakeBucketName`):

```bash
BUCKET=$(aws cloudformation describe-stacks --stack-name DwtEvents \
  --query "Stacks[0].Outputs[?OutputKey=='LakeBucketName'].OutputValue" --output text)
aws s3 ls "s3://$BUCKET/events/" --recursive
aws s3 ls "s3://$BUCKET/errors/" --recursive
```

Objects under `events/` are Parquet. Objects under `errors/` mean conversion failed (schema mismatch) — open one and read the error.

5. Optional: Athena → query database `dwt_lake` table `waste_movement_events`.

## Quiz

[`quiz.md`](quiz.md)
