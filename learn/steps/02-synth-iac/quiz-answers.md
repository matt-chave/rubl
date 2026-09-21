# Step 02 answers

1. `npx cdk synth` (or `npm run synth`).
2. So a payment worker failure cannot block national ingestion. SQS + DLQ isolate retries.
3. So `cdk synth` runs with no credentials. Real deploys set `CDK_DEFAULT_ACCOUNT`.
4. Usage plans and API keys exist on REST APIs, not HTTP APIs. We need both JWT and `x-api-key`.
5. Dual-write: DynamoDB succeeds and `PutEvents` fails, so the lake never sees a legally stored movement.
