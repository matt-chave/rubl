# Step 10 — Remaining endpoints and prod promotion

## What is happening

The API already wired **all** OpenAPI operations in `DwtApi` (step 07). This step is about **using** them as a journey, then understanding what “prod” means.

Journey on the same `TOKEN` + `API_KEY` + `API_BASE`:

1. `POST /movements` → `movementId`
2. `POST /movements/{movementId}/collection` (STATIC)
3. `POST /deliveries` with that id → `deliveryId`
4. `POST /deliveries/{deliveryId}/receipt`
5. `GET /movements/{movementId}/fate-of-waste`
6. `GET /reference-data/ewc-codes`

Request bodies follow the OpenAPI required fields (collection needs full `carrier`, `dutyOfCareConfirmed`, `collectionSite`, etc.). Use the spec, not only the create fixture.

## Automated check

```bash
npm run learn -- 10
```

Confirms stacks 05–09 are still complete and lists the remaining route operationIds in the CDK source.

## Manual steps

1. Walk the journey with curl or Bruno. After each write, `GetItem` on `CURRENT` in DynamoDB.
2. `GET .../fate-of-waste` — status should move CREATED → COLLECTED → DELIVERED → RECEIVED.
3. Read [learn/environments.md](../../environments.md) **prod** section again.
4. Checklist before any real prod account (do not run these against sandbox as if they were prod):

   - Separate AWS account and profile
   - `RemovalPolicy.RETAIN` on tables and the lake bucket
   - No `autoDeleteObjects` on S3
   - WAF / private API if a Defra landing zone requires it (out of scope for this sandbox)
   - Secrets rotation for Cognito client and API key
   - `cdk diff` reviewed by a human before `cdk deploy`

5. To tear down the **sandbox** when you have finished learning:

```bash
npx cdk destroy DwtApi DwtCharging DwtEvents DwtLedger DwtAuth
```

Order matters: dependents first.

## Quiz

[`quiz.md`](quiz.md)

## After this tutorial

Keep using [learn/qa/index.md](../../qa/index.md). Next questions you ask in Cursor should land there automatically (see `.cursor/rules/tutorial-qa.mdc`).
