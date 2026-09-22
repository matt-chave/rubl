# Architecture: reporting a waste movement

This workshop implements **one slice** of the Digital Waste Tracking Service: vendor software **reporting a domestic waste movement** through the REST API (OpenAPI 0.3-alpha). It is not the whole DWTS estate.

The design constraint that drives every AWS choice: at national scale (on the order of **hundreds of millions of movements a year**) a vendor POST must succeed even if the data lake or charging is slow or down. The durable ledger write is the source of truth. Everything else is **asynchronous fan-out**.

## Scope of “report a waste movement”

A movement is the legal record of waste travelling from a **producer**, with **carrier(s)**, to a **receiver**. The OpenAPI journey this repo implements:

| Stage | Who reports | HTTP (typical) | What it means |
|---|---|---|---|
| **Create** | Carrier or broker (initiator) | `POST /movements` | Planned movement: producer, intended carriers, waste items, planned collection time |
| **Collect** | Carrier / driver | `POST /movements/{id}/collection` | Waste has left the producer |
| **Deliver** | Carrier | `POST /deliveries` | Waste arrived at a site; mints a Delivery ID |
| **Receive** | Receiving site | `POST /deliveries/{id}/receipt` or `POST /receipts` | Site accepts the waste (Phase 1 also had receipt-only paths) |
| **Fate** | Producer-facing read | `GET /movements/{id}/fate-of-waste` | Status / outcome query |

Updates (`PUT`) revise a stage and snapshot the previous CURRENT record into **history**. Soft-delete is a lifecycle rule, not a DynamoDB `DeleteItem`.

**In this repo**

- Vendor **machine-to-machine** API (OAuth2 client credentials + API key)
- Append-only movement **events** plus a CURRENT snapshot
- Async **regulatory lake** (bronze JSON then silver Parquet on S3) and **charging** (operator ledger)
- Bundled **reference data** GETs (EWC codes, containers, …)

**Not in this slice** (real DWTS neighbours, left out on purpose)

- Human login (GOV.UK One Login), WAF/Shield, private API + VPC
- Spreadsheet upload, operator self-serve UI
- Legal-entity / permit register as its own system
- International waste (TFS)
- Statutory BI dashboards and regulator case-working
- GOV.UK Pay and waste-operator onboarding (the £26 annual fee belongs on the **same** operator ledger; this slice only writes per-event placeholder lines)

UK legislation allows reporting within a **window** (often discussed as 48 hours), so the physical world can be out of order. This tutorial still enforces some **lifecycle** rules in `rules.ts` (for example you cannot collect a deleted movement). Treat that as a teaching subset, not a full reconciliation engine.

## Why five stacks

Stacks follow **bounded contexts**, not “one VPC for everything.” A billing outage must not take down `POST /movements`.

| Stack | Context | Runtime job |
|---|---|---|
| `DwtAuth` | IAM | Issue vendor JWTs (Cognito stands in for Defra identity) |
| `DwtLedger` | Core Movements | Durable events, CURRENT, history, ID sequences |
| `DwtApi` | Core Movements (edge) | HTTP, auth at the door, one Lambda per operation |
| `DwtEvents` | Regulatory reporting (lake) | Fan-out from the ledger stream to bronze JSON, then silver Parquet |
| `DwtCharging` | Billing | Isolated operator ledger off the hot path |

The wider DWTS map also has Legal Entity, International Waste, a proper Reference Data service, and Developer Experience. Those are **not** deployed here.

## Path of one accepted POST

```
Vendor software
  │  Bearer JWT + x-api-key
  ▼
API Gateway REST  →  JWT authorizer + usage plan
  ▼
Lambda (e.g. createMovement)
  │  validateOperation → rules → mint sqid → PutItem
  ▼
DynamoDB movements (EVENT + CURRENT)
  │  Stream NEW_IMAGE (EVENT items only)
  ▼
EventBridge Pipe + enrichment Lambda
  ▼
Event bus dwt-waste-movements
  ├─► Kinesis → Firehose → S3 bronze/ (JSON) → Glue job → S3 silver/ (Parquet)
  └─► SQS → charging Lambda → operator ledger table
```

The API Lambda does **not** call `PutEvents`. If DynamoDB succeeded and the bus failed, the lake would miss a legally stored movement. **DynamoDB Streams** make the stored EVENT the publisher.

## Requirement → AWS component

| Movement requirement | Component | Why this, not a simpler thing |
|---|---|---|
| Only registered vendor software may write | Cognito + API Gateway JWT authorizer | Check the token at the edge (JWKS). Lambdas must not call the IdP per movement |
| Throttle / revoke one vendor without rotating all secrets | REST API key + usage plan | Keys and usage plans exist on **REST (v1)**, not HTTP API |
| Reject a bad body before we persist | Lambda + `src/lib/validation` | Contract subset in TypeScript; lifecycle stays in `rules.ts` |
| Speakable public ID (`25HRA0B2`) | DynamoDB sequences + sqids | Atomic counter; callers must not parse the year prefix |
| Legal trail cannot be overwritten | DynamoDB EVENT items (append-only) | We do not `UpdateItem` the event log. PUT snapshots CURRENT → history |
| Fast “where is this movement?” | DynamoDB CURRENT + GSI | One item to read; events remain the audit log |
| Lake / billing must not block ingestion | Streams → EventBridge → Kinesis / SQS | Async fan-out; two consumers, one durable write |
| Regulators need cheap analytical scans | Firehose bronze JSON + Glue silver Parquet + S3 | Land the raw envelope; convert later so a spec change cannot drop the only copy |
| A charging outage must not reject POSTs | SQS + DLQ + alarm | Queue isolates billing; alarm is how operators learn a line was missed |
| Swap Defra identity later | Cognito as a stand-in | Change token URL / JWKS at the gateway, not the handlers |
| UK data residency default | Region `eu-west-2` | London |

## Each component — what it does and why

### [Amazon Cognito](https://docs.aws.amazon.com/cognito/latest/developerguide/what-is-amazon-cognito.html) (`DwtAuth`)

**What:** User pool, M2M app client, hosted domain so there is an `/oauth2/token` endpoint.

**Why:** Vendors are **machines**. They use the client-credentials grant (`client_id` + `client_secret` → JWT with scope `dwt/movements`). Humans clicking GOV.UK One Login are out of scope. Cognito is a sandbox stand-in; a later Defra issuer should not rewrite Lambdas.

### [API Gateway](https://docs.aws.amazon.com/apigateway/latest/developerguide/welcome.html) REST (`DwtApi`)

**What:** HTTPS edge. Cognito JWT authorizer plus a required `x-api-key` on every route.

**Why:** One place to reject unauthenticated or over-quota callers before compute runs. REST (v1) is required for **usage plans and API keys**. HTTP API cannot do that pairing.

### [AWS Lambda](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html) — one per OpenAPI `operationId` (`DwtApi`)

**What:** Node.js 22 handlers. Shared code in `src/lib/` (validate, ids, ledger, rules).

**Why:** A waste movement is a **command**. Each endpoint can scale and deploy on its own. The handler stays thin: validate → apply rules → write DynamoDB. It must not call billing or the lake.

### [Amazon DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html) — movements table (`DwtLedger`)

**What:** Partition/sort key items. `EVENT` rows are append-only facts. `CURRENT` is the latest snapshot. Stream view `NEW_IMAGE`.

**Why:** Single-digit millisecond writes at ingestion volume. Pay-per-request matches bursty national traffic. The stream is how the rest of the system learns a write happened **after** it is durable.

### Amazon DynamoDB — history and sequences (`DwtLedger`)

**What:** History holds previous CURRENT snapshots when a PUT revises a movement. Sequences hold atomic counters for year-prefixed sqids.

**Why:** The OpenAPI “revision” story needs an old version you can still show. IDs must be unique without a central SQL sequence.

### [DynamoDB Streams](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.html)

**What:** Ordered change log of the movements table.

**Why:** The ledger publishes itself. No dual-write from the API Lambda.

### [EventBridge Pipes](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes.html) + enrichment Lambda (`DwtEvents`)

**What:** Pipe reads the stream, **filters** to `itemType = EVENT` (CURRENT must not become a domain event), invokes `streamEnrichment` to unmarshall the DynamoDB image into a plain envelope, then `PutEvents` on the bus.

**Why:** Streams speak DynamoDB’s typed JSON. Downstream consumers need a stable `WasteMovementEvent`. The filter keeps snapshots off the bus.

### [EventBridge](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-what-is.html) custom bus `dwt-waste-movements`

**What:** One bus, many rules.

**Why:** Pub/sub. The lake and charging **subscribe** independently. Adding a third consumer later does not change the API Lambda.

### [Kinesis Data Streams](https://docs.aws.amazon.com/streams/latest/dev/introduction.html)

**What:** Ordered buffer of envelopes (`$.detail` from the bus).

**Why:** Firehose wants a stream it can read at lake pace. Kinesis absorbs ingest spikes so bronze JSON can batch.

### [Kinesis Data Firehose](https://docs.aws.amazon.com/firehose/latest/dev/what-is-this-service.html) + [AWS Glue](https://docs.aws.amazon.com/glue/latest/dg/what-is-glue.html) + [Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html)

**What:** Firehose writes the envelope as **JSON lines** under `bronze/events/`. An on-demand Glue job reads bronze and writes **Parquet** under `silver/events/`, and registers `dwt_lake.silver_waste_movement_events`. `payload` stays a nested JSON object.

**Why:** Bronze is the durable landing zone. Silver is a later, rebuildable projection for cheap Athena scans. Converting in Firehose would need a Glue schema *at write time* — a new OpenAPI field would send the record to `errors/` and you would lose the only copy.

### [Amazon SQS](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html) + DLQ (`DwtCharging`)

**What:** EventBridge rule matches **chargeable** event types only, then enqueues. After five failures the message lands on a DLQ; a CloudWatch alarm fires.

**Why:** Charging is a **different failure domain**. If the worker is down, vendors still get `201`. The DLQ is the operational signal that a payment line was not recorded.

### AWS Lambda — charging + operator ledger DynamoDB

**What:** Reads the queue, writes one ledger line per event (placeholder tariff).

**Why:** Billing language (operator, tariff, line) must not live in the movements table. Per-event lines and the £26 annual fee share this ledger (`PK=OPERATOR#`); they differ by SK and trigger. Onboarding / GOV.UK Pay are later.

### [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/home.html)

**What:** TypeScript in `infra/` synthesises CloudFormation (`cdk.out/`).

**Why:** The architecture is reviewed as code. `cdk synth` is the plan; `cdk deploy` is later (steps 05–10).

## What to open in the layout

| You are asking | Open |
|---|---|
| Who may call the API? | `infra/lib/stacks/auth-stack.ts`, API Gateway authorizer in `api-stack.ts` |
| What is a movement in law? | `openapi/openapi.yaml` (`createMovementRequest`), `src/lib/validation/`, `src/lib/rules.ts` |
| Where is the truth stored? | `infra/lib/stacks/ledger-stack.ts`, `src/lib/ledger.ts` |
| How does the lake hear about it? | `infra/lib/stacks/events-stack.ts` |
| How does charging stay off the POST? | `infra/lib/stacks/charging-stack.ts` |
