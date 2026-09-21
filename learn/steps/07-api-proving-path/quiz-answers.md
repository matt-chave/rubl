# Step 07 answers

1. 201 after DynamoDB write. S3 is an asynchronous consumer.
2. `400` with `validation.errors` (`NotProvided` on `apiCode`).
3. JWT = who the vendor software is. API key = usage plan / rate limit / revoke a key without rotating OAuth clients.
4. Sequence table + sqids in the Lambda (`src/lib/ids.ts` / `ledger.ts`).
5. The handler does not call EventBridge. The stream/Pipe is a later consumer.
