# Step 04 answers

1. You can complete 01–04b (design, tests, synth, GitHub). 05–10 need real AWS for the EDA path. You can *read* 05–10 without deploying.
2. Cognito client-credentials + API Gateway JWT authorizer; EventBridge Pipes; Firehose bronze JSON + Glue silver Parquet.
3. So `cdk destroy` / `RemovalPolicy.DESTROY` in the sandbox cannot delete the legal production lake.
4. `eu-west-2` (London) — UK public-sector default.
5. **You** create them (Cursor cannot). A named profile (e.g. `dwt-dev`) is a saved CLI login on your laptop. Path A: IAM user + `aws configure --profile dwt-dev`. Path B: work SSO + `aws configure sso` then `aws sso login`. Never paste access keys into Cursor.
