# Step 08 answers

1. Firehose buffering (interval and/or size).
2. Unmarshall DynamoDB typed images (`{ S: "..." }`) into the envelope and stringify `payload`.
3. `CURRENT` and `HISTORY` items also hit the stream. They are not domain events.
4. The S3 `errors/` prefix (`errorOutputPrefix`).
5. No. Ingestion finished at DynamoDB. The lake is a consumer. Debug the Pipe/Firehose, not the API.
