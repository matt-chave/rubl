# Step 10 answers

1. It reads `CURRENT` plus a query of `EVENT#` items and builds a summary. The OpenAPI response schema is still a proposal.
2. Hazardous movements cannot share a delivery; each gets `deliveryId` equal to its Movement ID. Non-hazardous movements on the same POST share one minted id.
3. A separate AWS account; `RemovalPolicy.RETAIN` on tables and the lake; no auto-delete on S3; tighter IAM; no dummy account.
4. Destroy Api, Charging, and Events first, then Ledger, then Auth, because CloudFormation exports and cross-stack references will otherwise block the delete.
5. Still out of scope for this slice: WAF, VPC, GOV.UK One Login, GOV.UK Pay, the £26 subscription, spreadsheet upload, and regulatory BI.
