# Step 08 answers

1. Firehose buffering (interval and/or size).
2. Unmarshall DynamoDB typed images (`{ S: "..." }`) into the envelope. It keeps `payload` as a JSON object.
3. `CURRENT` and `HISTORY` items also hit the stream. They are not domain events.
4. The S3 `bronze/errors/` prefix (`errorOutputPrefix`). Delivery failed (IAM, stream). Conversion is the silver job, so a bad OpenAPI shape cannot drop the bronze object.
5. No. Ingestion finished at DynamoDB. The lake is a consumer. Debug the Pipe/Firehose, not the API.
6. Bronze is the durable raw JSON. Silver Parquet is rebuildable. Write-time Glue conversion would lose records when the OpenAPI body changes.
