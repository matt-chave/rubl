# Step 11 — Reserve public IDs for offline clients

## What is happening

Operator software sometimes has to **print or store a Movement / Delivery ID while offline**. Today those IDs are minted only when `POST /movements` or `POST /deliveries` hits DynamoDB. Everything after that write is still asynchronous. The missing piece is an ID *before* CURRENT exists.

```
POST /id-reservations     → movementIds + deliveryIds + expiresAt + inCirculation
  (offline paperwork uses those strings)
POST /movements           { movementId }   claim
POST …/collection
POST /deliveries          { deliveryId }   claim (non-hazardous only)
GET  …/fate-of-waste
```

Reservation **reuses** the same year-prefixed sqids and atomic counters as online mint ([`src/lib/ids.ts`](../../../src/lib/ids.ts), [`nextSequence`](../../../src/lib/ledger.ts)). It is **not** a waste event: no EVENT row, so the lake and charging stay quiet.

An operator may hold **at most 50 unused IDs** (movement + delivery) at once. The cap is keyed on the operator resolved from the API key, not on the software `client_id`. Asking for 80 returns at most 50. Asking for 50 while 10 from a previous request are still unused returns **40**. Movements are filled first, then deliveries. Claimed or expired IDs leave circulation so the operator can reserve again. The row still records which software reserved (`reservedByClientId`); that is audit, not ownership.

Unused reservations expire after `ID_RESERVATION_TTL_DAYS` (default **30**). Expiry **deletes the reservation row**. The public string is **never recycled** — the sequence number is already consumed, so an online mint cannot collide. Recycling `26HRA0B2` to another operator would be unsafe: the first holder may still have printed it.

## Where the code is

- Contract: `POST /id-reservations` (`reserveIds`) in [`openapi/openapi.yaml`](../../../openapi/openapi.yaml); optional `movementId` / `deliveryId` on create and delivery
- Table: `IdReservations` on [`DwtLedger`](../../../infra/lib/stacks/ledger-stack.ts) — PK `ID#<publicId>`, GSI `OWNER#{operatorId}#RESERVED` for the circulation cap, TTL on `ttl`. Not on the movements table
- Handler: [`src/lambdas/reserveIds/`](../../../src/lambdas/reserveIds/) → [`src/lib/operations/reservations.ts`](../../../src/lib/operations/reservations.ts)
- Claim: [`createMovement`](../../../src/lib/operations/movements.ts) and [`recordDelivery`](../../../src/lib/operations/deliveries.ts) (hazardous still sets `deliveryId = movementId`)

## Why this stack change alone

If reservations lived on the movements table, DynamoDB TTL could theoretically sit next to legal CURRENT/EVENT items. A separate table keeps expiry off the ledger. The Pipe still filters `itemType=EVENT`, so a reservation would not have charged anyway — isolation is the point.

## Automated check

```bash
npm run learn -- 11
```

Confirms stacks 05–10 are still complete, `DwtLedger` has output `ReservationsTableName`, and CDK declares `reserveIds` + `IdReservations` with TTL. It does **not** reserve an ID.

## Manual steps — Bruno

Reuse collection `dwt-sandbox` and environment **dev** from [step 10](../10-remaining-and-prod/README.md). Same `token` + `apiKey` + `apiBase`. Do not paste tokens or API keys into chat.

### 0. Deploy the new table and route

A new DynamoDB table and a new Lambda. Profile as before.

```bash
export AWS_PROFILE=dwt-dev
export AWS_DEFAULT_REGION=eu-west-2
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=eu-west-2
npx cdk deploy DwtLedger DwtApi
```

Answer **`y`** if CDK asks about IAM. [CloudFormation stacks](https://eu-west-2.console.aws.amazon.com/cloudformation/home?region=eu-west-2#/stacks) → `DwtLedger` **Outputs** should include `ReservationsTableName`. [DynamoDB tables](https://eu-west-2.console.aws.amazon.com/dynamodbv2/home?region=eu-west-2#tables) will show a new `DwtLedger-IdReservations…` table.

### 1. Get token

Same **Get token** request as step 10. **Send**. Expect **200**. Confirm `dev` → `token` starts `eyJ`.

### 2. Reserve one movement ID and one delivery ID

1. New request → name `Reserve IDs` → **POST**.
2. URL: `{{apiBase}}/id-reservations`
3. Headers: `Authorization: Bearer {{token}}` (software JWT), `x-api-key: {{apiKey}}` (operator key), `Content-Type: application/json`
4. **Body** → **JSON** = [`learn/fixtures/reserve-ids.json`](../../fixtures/reserve-ids.json)
5. **Tests**:

   ```javascript
   const body = typeof res.getBody === "function" ? res.getBody() : res.body;
   const parsed = typeof body === "string" ? JSON.parse(body) : body;
   if (parsed && parsed.movementIds && parsed.movementIds[0]) {
     bru.setEnvVar("movementId", parsed.movementIds[0]);
   }
   if (parsed && parsed.deliveryIds && parsed.deliveryIds[0]) {
     bru.setEnvVar("deliveryId", parsed.deliveryIds[0]);
   }
   ```

6. **Send**. Expect **201**, two ids, `expiresAt` about 30 days out, and `inCirculation` of at least 2. Confirm `dev` has both ids. There is still **no** CURRENT row for that movement.

### 3. Create movement with the reserved id

Duplicate **Create movement**. Keep the create fixture body, and add:

```json
"movementId": "{{movementId}}"
```

**Send**. Expect **201** and the **same** `movementId` you reserved (not a newly minted one). A second Send with the same id is **409** `ALREADY_EXISTS` or **400** `IdNotReserved` (already consumed).

### 4–6. Collection, delivery, fate

Same as [step 10](../10-remaining-and-prod/README.md) steps 3–6. On **Record delivery**, set `"deliveryId": "{{deliveryId}}"` in the body (and `"movementIds": ["{{movementId}}"]`). Hazardous movements ignore a reserved delivery id — this fixture is non-hazardous.

**401** → run **Get token** again. Do not paste the token here.

## Alternative: curl

Same terminal as `export AWS_PROFILE=dwt-dev` / `AWS_DEFAULT_REGION=eu-west-2`. Collect `API_BASE`, `API_KEY`, `TOKEN` as in step 10.

```bash
RESERVE=$(curl -sS -X POST "$API_BASE/id-reservations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  --data-binary @learn/fixtures/reserve-ids.json)
echo "$RESERVE" | jq .
MOVEMENT_ID=$(echo "$RESERVE" | jq -r '.movementIds[0]')
DELIVERY_ID=$(echo "$RESERVE" | jq -r '.deliveryIds[0]')

jq --arg id "$MOVEMENT_ID" '.movementId = $id' learn/fixtures/create-movement.json | \
  curl -sS -D - -X POST "$API_BASE/movements" \
    -H "Authorization: Bearer $TOKEN" \
    -H "x-api-key: $API_KEY" \
    -H "content-type: application/json" \
    --data-binary @-
```

Then collection / delivery / fate as step 10, injecting `$DELIVERY_ID` on the delivery body.

## Next

Step 12 puts those reserved IDs behind a first-party GOV.UK operator app and Web Component widgets for Create movement.

## Quiz

[`quiz.md`](quiz.md)

## Save your work (GitHub)

From the **repo root** (`rubl/`). Why and what not to commit: [`learn/commit.md`](../../commit.md).

```bash
git status
git add -A
git status
git commit -m "learn: complete step 11 — offline id reservations"
git push
```

`nothing to commit` is fine if you only read. Do not commit `.env`, keys, or tokens.
