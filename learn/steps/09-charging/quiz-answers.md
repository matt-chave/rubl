# Step 09 answers

1. Ingestion still returns 201. Events pile up on SQS / DLQ.
2. `PutItem` with condition `attribute_not_exists` on `PAYMENT#<eventId>`.
3. Updates and soft-deletes, e.g. `MOVEMENT_UPDATED`, `DELIVERY_DELETED`.
4. Messages that failed processing five times — human/ops intervention.
5. No. Same operator ledger (`PK=OPERATOR#`). Different SK (subscription period, not `PAYMENT#eventId`). First incurred at operator onboarding, then annually. GOV.UK Pay / onboarding are later.
