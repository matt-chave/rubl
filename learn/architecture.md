# Architecture: reporting a waste movement

This workshop implements **one slice** of the Digital Waste Tracking Service: approved software **reporting a domestic waste movement** for a waste operator through the REST API (OpenAPI 0.3-alpha). It is not the whole DWTS estate.

The design constraint that drives every AWS choice: at national scale (on the order of **hundreds of millions of movements a year**) an operator POST must succeed even if the data lake or charging is slow or down. The durable ledger write is the source of truth. Everything else is **asynchronous fan-out**.

## Scope of “report a waste movement”

A movement is the legal record of waste travelling from a **producer**, with **carrier(s)**, to a **receiver**. The OpenAPI journey this repo implements:

| Stage | Who reports | HTTP (typical) | What it means |
|---|---|---|---|
| **Reserve IDs** | Operator software (online, before going offline) | `POST /id-reservations` | Batch of unused Movement / Delivery IDs (same year-prefixed sqids). Max **50 unused in circulation** per operator. Not a waste event. Unused reservations expire and are never recycled. |
| **Create** | Carrier or broker (initiator) | `POST /movements` | Planned movement: producer, intended carriers, waste items, planned collection time. Optional `movementId` claims a reservation. |
| **Collect** | Carrier / driver | `POST /movements/{id}/collection` | The carrier reports that waste has left the producer. |
| **Deliver** | Carrier | `POST /deliveries` | Waste arrived at a site. The server mints a Delivery ID, or claims a reserved one for a non-hazardous delivery. |
| **Receive** | Receiving site | `POST /deliveries/{id}/receipt` or `POST /receipts` | The site accepts the waste. Phase 1 also had receipt-only paths. |
| **Fate** | Producer-facing read | `GET /movements/{id}/fate-of-waste` | Status and outcome query for that movement. |

Updates (`PUT`) revise a stage and snapshot the previous CURRENT record into **history**. Soft-delete is a lifecycle rule, not a DynamoDB `DeleteItem`.

This repo implements the **machine-to-machine** API (a software JWT from OAuth2 client credentials, plus an operator API key), optional **offline ID reservation** (`POST /id-reservations`) using the same sqids and expire-and-never-reuse rule, an append-only movement event log plus a CURRENT snapshot, an asynchronous **regulatory lake** (bronze JSON then silver Parquet on S3) and **charging** (operator ledger), bundled **reference data** GETs such as EWC codes and container types, **onboarding** Web Components `dwt-software-provider-signup` and `dwt-operator-signup` (lessons 5 and 5b) hosted by `apps/dwt-onboarding-ui`, and a **first-party GOV.UK operator UI** (step 12) that assembles Create-movement Web Components. The widgets only emit `dwt-change`, `dwt-valid`, and `dwt-submit`; they never hold secrets or call API Gateway. Signup credentials appear on the onboarding host after success. The create-movement shell (`WidgetHost` → `useSubmitMovement` / `useEnsureReservedIds`) talks to a local BFF, which mints the Cognito JWT, forwards the operator `x-api-key`, and proxies `POST /id-reservations` and `POST /movements` to `DwtApi`. The operator hands their key to the software; DWT does not pair them at auth time. We still record which software submitted.

Neighbouring DWTS work is left out on purpose: human login (GOV.UK One Login), WAF/Shield, a private API and VPC, spreadsheet upload, a legal-entity or permit register as its own system, international waste (TFS), statutory BI dashboards and regulator case-working, and GOV.UK Pay with waste-operator onboarding. Collection, delivery, receipt, and fate widgets are later lessons. The £26 annual fee belongs on the **same** operator ledger; this slice only writes per-event placeholder lines.

UK legislation allows reporting within a **window** (often discussed as 48 hours), so the physical world can be out of order. This tutorial still enforces some **lifecycle** rules in `rules.ts` (for example you cannot collect a deleted movement). Treat that as a teaching subset, not a full reconciliation engine.

## Why these stacks

Stacks follow **bounded contexts**, not “one VPC for everything.” A billing outage must not take down `POST /movements`.

| Stack | Context | Runtime job |
|---|---|---|
| `DwtAuth` | IAM | Issue software JWTs (Cognito stands in for Defra identity) |
| `DwtOnboarding` | Onboarding | Software-provider Cognito clients and waste-operator API keys (registration front door) |
| `DwtLedger` | Core Movements | Durable events, CURRENT, history, ID sequences |
| `DwtApi` | Core Movements (edge) | HTTP, auth at the door, one Lambda per operation |
| `DwtEvents` | Regulatory reporting (lake) | Fan-out from the ledger stream to bronze JSON, then silver Parquet |
| `DwtCharging` | Billing | Isolated operator ledger off the hot path |

The wider DWTS map also has Legal Entity, International Waste, a proper Reference Data service, and Developer Experience. Those are **not** deployed here.

## Path of one accepted POST

```
Operator software
  │  Bearer JWT (software) + x-api-key (operator)
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

Each AWS service is there for a movement requirement, not because the catalogue had a matching product.

| Movement requirement | Component | Why this, not a simpler thing |
|---|---|---|
| Only approved software may write | Cognito + API Gateway JWT authorizer | Check the token at the edge (JWKS). Lambdas must not call the IdP per movement |
| Identify and throttle one operator without rotating software secrets | REST operator API key + usage plan | Keys and usage plans exist on **REST (v1)**, not HTTP API. The key is issued at operator onboarding |
| Reject a bad body before we persist | Lambda + `src/lib/validation` | Contract subset in TypeScript; lifecycle stays in `rules.ts` |
| Speakable public ID (`25HRA0B2`) | DynamoDB sequences + sqids | Atomic counter; callers must not parse the year prefix |
| Legal trail cannot be overwritten | DynamoDB EVENT items (append-only) | We do not `UpdateItem` the event log. PUT snapshots CURRENT → history |
| Fast “where is this movement?” | DynamoDB CURRENT + GSI | One item to read; events remain the audit log |
| Lake / billing must not block ingestion | Streams → EventBridge → Kinesis / SQS | Async fan-out; two consumers, one durable write |
| Regulators need cheap analytical scans | Firehose bronze JSON + Glue silver Parquet + S3 | Land the raw envelope; convert later so a spec change cannot drop the only copy |
| A charging outage must not reject POSTs | SQS + DLQ + alarm | Queue isolates billing; alarm is how the billing team learns a line was missed |
| Swap Defra identity later | Cognito as a stand-in | Change token URL / JWKS at the gateway, not the handlers |
| UK data residency default | Region `eu-west-2` | London |

## Each component — what it does and why

### [Amazon Cognito](https://docs.aws.amazon.com/cognito/latest/developerguide/what-is-amazon-cognito.html) (`DwtAuth`)

[Cognito](https://eu-west-2.console.aws.amazon.com/cognito/v2/idp/user-pools?region=eu-west-2) holds a user pool, a machine-to-machine app client, and a hosted domain so there is an `/oauth2/token` endpoint. Approved software is a **machine**: it uses the client-credentials grant (`client_id` + `client_secret`) and receives a JWT with scope `dwt/movements`. That JWT is the software, not the waste operator. Humans clicking GOV.UK One Login are out of scope. Cognito is a sandbox stand-in; a later Defra issuer should not rewrite Lambdas. The sandbox client `dwt-vendor-software` proves the pool; new products self-register through `DwtOnboarding` (`CreateUserPoolClient` on the same pool) rather than another Auth deploy.

### Onboarding API (`DwtOnboarding`)

The onboarding team’s registration front door issues software Cognito clients (`POST /software-providers`, widget `dwt-software-provider-signup`) and waste-operator API keys (`POST /operators`, widget `dwt-operator-signup`). Profiles live on DynamoDB tables in this stack. Usage plan `dwt-operators` is created here; `DwtApi` attaches it to the movements stage. Secrets and key values are returned once and are not stored. This is not the movements API.

### [API Gateway](https://docs.aws.amazon.com/apigateway/latest/developerguide/welcome.html) REST (`DwtApi`)

[API Gateway](https://eu-west-2.console.aws.amazon.com/apigateway/main/apis?region=eu-west-2) is the HTTPS edge: a Cognito JWT authorizer plus a required operator `x-api-key` on every route. One place rejects unauthenticated or over-quota callers before compute runs. REST (v1) is required for **usage plans and API keys**; HTTP API cannot do that pairing. The sandbox seeds one operator key (`dwt-operator-sandbox`). Keys from operator signup sit on the same `dwt-operators` plan. There is no pairing grant and no `X-Operator-Id`.

### [AWS Lambda](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html) — one per OpenAPI `operationId` (`DwtApi`)

Each [Lambda](https://eu-west-2.console.aws.amazon.com/lambda/home?region=eu-west-2#/functions) is a Node.js 22 handler. Shared code in `src/lib/` covers validation, ids, the ledger, and rules. A waste movement is a **command**, so each endpoint can scale and deploy on its own. The handler stays thin: validate, apply rules, write DynamoDB. It must not call billing or the lake.

### [Amazon DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html) — movements table (`DwtLedger`)

The [movements table](https://eu-west-2.console.aws.amazon.com/dynamodbv2/home?region=eu-west-2#tables) stores partition/sort key items. `EVENT` rows are append-only facts. `CURRENT` is the latest snapshot. The stream view is `NEW_IMAGE`. Writes stay in single-digit milliseconds at ingestion volume, and pay-per-request matches bursty national traffic. The stream is how the rest of the system learns a write happened **after** it is durable.

### Amazon DynamoDB — history and sequences (`DwtLedger`)

History holds previous CURRENT snapshots when a PUT revises a movement. Sequences hold atomic counters for year-prefixed sqids. The OpenAPI “revision” story needs an old version you can still show, and IDs must be unique without a central SQL sequence.

### [DynamoDB Streams](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.html)

[Streams](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.html) are the ordered change log of the movements table. The ledger publishes itself, so there is no dual-write from the API Lambda.

### [EventBridge Pipes](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-pipes.html) + enrichment Lambda (`DwtEvents`)

The Pipe reads the stream, **filters** to `itemType = EVENT` (CURRENT must not become a domain event), invokes `streamEnrichment` to unmarshall the DynamoDB image into a plain envelope, then `PutEvents` on the bus. Streams speak DynamoDB’s typed JSON; downstream consumers need a stable `WasteMovementEvent`. The filter keeps snapshots off the bus.

### [EventBridge](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-what-is.html) custom bus `dwt-waste-movements`

[EventBridge](https://eu-west-2.console.aws.amazon.com/events/home?region=eu-west-2#/eventbuses) is one bus with many rules. The lake and charging **subscribe** independently. Adding a third consumer later does not change the API Lambda.

### [Kinesis Data Streams](https://docs.aws.amazon.com/streams/latest/dev/introduction.html)

[Kinesis](https://eu-west-2.console.aws.amazon.com/kinesis/home?region=eu-west-2#/streams/list) is an ordered buffer of envelopes (`$.detail` from the bus). Firehose wants a stream it can read at lake pace. Kinesis absorbs ingest spikes so bronze JSON can batch.

### [Kinesis Data Firehose](https://docs.aws.amazon.com/firehose/latest/dev/what-is-this-service.html) + [AWS Glue](https://docs.aws.amazon.com/glue/latest/dg/what-is-glue.html) + [Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html)

Firehose writes the envelope as **JSON lines** under `bronze/events/`. An on-demand Glue job reads bronze, writes **Parquet** under `silver/events/`, and registers `dwt_lake.silver_waste_movement_events`. `payload` stays a nested JSON object. Bronze is the durable landing zone. Silver is a later, rebuildable projection for cheap Athena scans. Converting in Firehose would need a Glue schema *at write time* — a new OpenAPI field would send the record to `errors/` and you would lose the only copy.

### [Amazon SQS](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html) + DLQ (`DwtCharging`)

An EventBridge rule matches **chargeable** event types only, then enqueues on [SQS](https://eu-west-2.console.aws.amazon.com/sqs/v3/home?region=eu-west-2#/queues). After five failures the message lands on a DLQ and a CloudWatch alarm fires. Charging is a **different failure domain**. If the worker is down, vendors still get `201`. The DLQ is the operational signal that a payment line was not recorded.

### AWS Lambda — charging + operator ledger DynamoDB

The charging Lambda reads the queue and writes one ledger line per event (placeholder tariff). Billing language (operator, tariff, line) must not live in the movements table. Per-event lines and the £26 annual fee share this ledger (`PK=OPERATOR#`); they differ by SK and trigger. Onboarding and GOV.UK Pay are later.

### [AWS CDK](https://docs.aws.amazon.com/cdk/v2/guide/home.html)

TypeScript in `infra/` synthesises CloudFormation (`cdk.out/`). The architecture is reviewed as code. `cdk synth` is the plan; `cdk deploy` is later (steps 05–10).

## What to open in the layout

When you have a question, start with the file that owns that decision.

| You are asking | Open |
|---|---|
| Who may call the API? | `infra/lib/stacks/auth-stack.ts`, API Gateway authorizer in `api-stack.ts` |
| What is a movement in law? | `openapi/openapi.yaml` (`createMovementRequest`), `src/lib/validation/`, `src/lib/rules.ts` |
| Where is the truth stored? | `infra/lib/stacks/ledger-stack.ts`, `src/lib/ledger.ts` |
| How does the lake hear about it? | `infra/lib/stacks/events-stack.ts` |
| How does charging stay off the POST? | `infra/lib/stacks/charging-stack.ts` |
| How does an operator report without vendor software? | `apps/dwt-operator-ui`, `apps/dwt-bff`, `packages/dwt-mfe-create-movement` |
