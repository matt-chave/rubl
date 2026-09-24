# Step 08 answers

1. Firehose buffers by interval and/or size, so bronze is not immediate after the 201.
2. The enrichment Lambda unmarshalls DynamoDB typed images (`{ S: "..." }`) into the envelope and keeps `payload` as a JSON object. Firehose cannot do that conversion.
3. `CURRENT` and `HISTORY` items also hit the stream. They are snapshots, not domain events, so they must not land on the bus.
4. Failed deliveries go to the S3 `bronze/errors/` prefix (`errorOutputPrefix`). That is a delivery failure (IAM or the stream), not a Parquet schema error. Conversion is the silver job, so a bad OpenAPI shape cannot drop the bronze object.
5. No. Ingestion finished at DynamoDB. The lake is a consumer. Debug the Pipe or Firehose, not the API.
6. Bronze is the durable raw JSON. Silver Parquet is rebuildable. Write-time Glue conversion would lose records when the OpenAPI body changes.
