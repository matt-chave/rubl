# Step 02 answers

1. `npx cdk synth` (or `npm run synth`) writes CloudFormation under `cdk.out/` without creating anything in an account.
2. Charging is its own stack, and sits behind SQS, so a payment-worker failure cannot block national ingestion. The queue and DLQ isolate retries from the legal write.
3. The dummy account lets `cdk synth` run with no credentials. Real deploys set `CDK_DEFAULT_ACCOUNT` to the sandbox.
4. Usage plans and API keys exist on REST APIs, not HTTP APIs. This slice needs both a JWT and `x-api-key`.
5. A dual-write: DynamoDB can succeed while `PutEvents` fails, so the lake would never see a legally stored movement. Streams publish after the EVENT item exists.
