# Step 07 answers

1. Ingestion is done when API Gateway returns 201 after the DynamoDB write. The S3 object is an asynchronous consumer and can arrive later.
2. `400` with `validation.errors`, typically `NotProvided` on `apiCode`.
3. The JWT says which approved software is calling. The `x-api-key` is the waste operator, issued at onboarding (sandbox: `dwt-operator-sandbox`). The same key also sits on a usage plan so we can throttle or revoke one operator without rotating the software client. DWT does not pair them at auth time; we still record which software submitted.
4. The Lambda mints it from the sequence table plus sqids (`src/lib/ids.ts` / `ledger.ts`).
5. The handler does not call EventBridge. The stream and Pipe are later consumers, so this step can succeed before Firehose exists.
