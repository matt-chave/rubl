# Step 08 quiz

1. Why wait after POST before looking in S3 bronze?
2. What does the enrichment Lambda do that Firehose cannot?
3. Why filter the Pipe on `itemType = EVENT`?
4. Where do failed Firehose deliveries go, and why is that *not* a Parquet schema error?
5. If bronze is empty but DynamoDB has the event, is ingestion broken?
6. Why is silver a later Glue job instead of Firehose converting to Parquet on write?
