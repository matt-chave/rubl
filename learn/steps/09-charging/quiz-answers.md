# Step 09 answers

1. Ingestion still returns 201. Unprocessed events pile up on SQS and, after retries, the DLQ.
2. `PutItem` with a condition of `attribute_not_exists` on `PAYMENT#<eventId>`, so a replay of the same event is a no-op.
3. Updates and soft-deletes are not chargeable. Examples include `MOVEMENT_UPDATED` and `DELIVERY_DELETED`.
4. The DLQ holds messages that failed processing five times, so a person or ops process can intervene.
5. No. The £26 fee uses the same operator ledger (`PK=OPERATOR#`) with a different SK (a subscription period, not `PAYMENT#eventId`). It is first incurred at operator onboarding, then annually. GOV.UK Pay and onboarding themselves are later work.
