# Step 10 answers

1. It reads `CURRENT` plus a query of `EVENT#` items to build a summary. The OpenAPI response schema is still a proposal.
2. Hazardous movements cannot share a delivery; each gets `deliveryId = movementId`. Non-hazardous ones share a minted id.
3. Separate account; `RemovalPolicy.RETAIN`; no auto-delete on S3; tighter IAM; no dummy account.
4. Api / Charging / Events first, then Ledger, then Auth — CloudFormation exports / cross-stack references.
5. WAF, VPC, GOV.UK One Login, GOV.UK Pay, the £26 subscription, spreadsheet upload, regulatory BI.
