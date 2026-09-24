# Step 04 answers

1. You can complete steps 01–04b (design, tests, synth, GitHub) without an account. Steps 05–10 need real AWS for the event-driven path, though you can still read those lessons without deploying.
2. LocalStack will not teach Cognito client-credentials with the API Gateway JWT authorizer, EventBridge Pipes, or Firehose bronze JSON plus a Glue silver Parquet job.
3. Production is a different AWS account so `cdk destroy` and `RemovalPolicy.DESTROY` in the sandbox cannot delete the legal production lake.
4. `eu-west-2` (London), the UK public-sector default.
5. You create them; Cursor cannot. A named profile such as `dwt-dev` is a saved CLI login on your laptop. Path A is an IAM user plus `aws configure --profile dwt-dev`. Path B is work SSO plus `aws configure sso`, then `aws sso login`. Never paste access keys into Cursor.
