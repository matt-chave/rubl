# Digital Waste Tracking Service

AWS implementation of the [DEFRA Digital Waste Tracking API](https://github.com/DEFRA/digital-waste-tracking-api-docs) (OpenAPI 0.3-alpha).

Vendor software calls a REST API. Each operation is its own Node.js 22 Lambda. A valid write mints a short, speakable public ID, stores an immutable event in DynamoDB, and fans that event out asynchronously so **ingestion never waits on the data lake or on charging**.

## Architecture

```
Vendor
  │  Authorization: Bearer <Cognito JWT>
  │  x-api-key: <API Gateway key>
  ▼
API Gateway REST  ── Cognito JWT authorizer + usage plan
  │
  ▼
Per-endpoint Lambda  ── validate → mint sqid → PutItem
  │
  ▼
DynamoDB (EVENT + CURRENT)
  │  Streams (NEW_IMAGE)
  ▼
EventBridge Pipe (+ enrichment Lambda)
  │
  ▼
EventBridge bus `dwt-waste-movements`
  ├─► Kinesis Data Stream → Firehose → S3 bronze/ (JSON) → Glue → S3 silver/ (Parquet)
  └─► SQS → Charging Lambda → operator ledger DynamoDB
```

Why Streams then EventBridge, not `PutEvents` from the API Lambda: a dual-write can succeed in DynamoDB and fail on the bus. The stored EVENT item is the source of truth.

## Repository layout

| Path | Purpose |
|---|---|
| [`openapi/openapi.yaml`](openapi/openapi.yaml) | Vendored DEFRA spec plus a local OAuth2 + API-key overlay |
| [`openapi/event-model/`](openapi/event-model/) | Pinned `$ref` closure (producer JSON Schema) so the YAML is self-contained |
| [`infra/`](infra/) | AWS CDK (TypeScript) — five stacks |
| [`src/lib/`](src/lib/) | Shared validation, IDs, ledger access, business rules |
| [`src/lambdas/`](src/lambdas/) | One folder per OpenAPI `operationId`, plus `charging` and `streamEnrichment` |
| [`data/reference/`](data/reference/) | Bundled taxonomy snapshots for GET `/reference-data/*` |
| [`test/`](test/) | Unit tests (no AWS account required) |
| [`learn/`](learn/) | Gated tutorial: steps, quizzes, Q&A, environment notes |
| [`learn/architecture.md`](learn/architecture.md) | Scope of reporting a movement and why each AWS component exists |

## Stacks

| Stack | Bounded context | What it creates |
|---|---|---|
| `DwtAuth` | IAM | Cognito User Pool, M2M app client, hosted-UI domain for the token endpoint |
| `DwtLedger` | Core Movements | Movements table + stream, history table, ID sequence table |
| `DwtEvents` | Regulatory reporting (lake) | Pipe, EventBridge bus, Kinesis, Firehose (bronze JSON), Glue silver Parquet, S3 |
| `DwtCharging` | Billing | SQS + DLQ, charging Lambda, operator ledger, DLQ alarm |
| `DwtApi` | Core Movements (edge) | REST API, Cognito authorizer, API key, one Lambda per operation |

Region defaults to **eu-west-2** (London).

## Tutorial (start here)

Work **one step at a time** in [`learn/`](learn/README.md). Automated checks, manual AWS CLI / curl instructions, quizzes, and a Q&A library live there. Steps 01–04b need **no AWS account**. Later steps deploy one stack at a time into a sandbox.

```bash
npm install
npm run learn:status
npm run learn -- 01
```

Environments (local / LocalStack mock / AWS dev / AWS prod): [`learn/environments.md`](learn/environments.md).  
Tools (Node, AWS CLI, jq, curl, Bruno): [`learn/tools.md`](learn/tools.md).

## Prerequisites (local synth — no AWS account)

- Node.js 22+
- npm

```bash
npm install
npm test
npx cdk synth
```

`cdk synth` writes CloudFormation to `cdk.out/`. It does **not** need credentials. The dummy account `000000000000` is used only so Cognito domain prefixes synthesise.

## Deploy (when you have an AWS account)

Do not paste access keys into chat. Configure the AWS CLI locally, then:

```bash
export AWS_PROFILE=your-sandbox-profile
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=eu-west-2

npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/eu-west-2
npx cdk deploy --all
```

After deploy, copy these outputs into a password manager (not git):

- `DwtAuth.ClientId`, token URL (`DwtAuth.TokenUrl`), and the client secret from the Cognito console (App client)
- `DwtApi.ApiBaseUrl`
- API key value from Secrets Manager (`DwtApi.ApiKeySecretArn`)

### Call the API

```bash
TOKEN=$(curl -s -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d grant_type=client_credentials \
  -d scope=dwt/movements \
  "$TOKEN_URL" | jq -r .access_token)

API_KEY=$(aws secretsmanager get-secret-value --secret-id "$API_KEY_SECRET_ARN" --query SecretString --output text)

curl -sS -X POST "$API_BASE_URL/movements" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-api-key: $API_KEY" \
  -H "content-type: application/json" \
  -d @- <<'EOF'
{
  "apiCode": "25b14080-5e77-4f91-9957-2482a0cb8775",
  "plannedCollectionTime": "2025-09-15T08:00:00Z",
  "producer": {
    "wasteSource": "Commercial",
    "organisationName": "Test Producer Ltd",
    "sicCode": "38110",
    "authorisationNumber": "EPR/AB1234CD",
    "emailAddress": "producer@example.co.uk",
    "address": { "fullAddress": "1 Test Street, London", "postcode": "SW1A 1AA" }
  },
  "intendedCarriers": [
    {
      "meansOfTransport": "Road",
      "organisationName": "Test Carrier Ltd",
      "emailAddress": "carrier@example.co.uk"
    }
  ],
  "wasteItems": [
    {
      "weight": { "metric": "Tonnes", "amount": 1.5, "isEstimate": true },
      "numberOfContainers": 2,
      "typeOfContainers": "SKI",
      "physicalForm": "Solid",
      "classification": {
        "ewcCodes": ["200108"],
        "wasteDescription": "Kitchen waste",
        "containsPops": false,
        "containsHazardous": false
      },
      "intendedTreatments": [
        {
          "disposalOrRecoveryCode": "R3",
          "weight": { "metric": "Tonnes", "amount": 1.5, "isEstimate": true }
        }
      ]
    }
  ]
}
EOF
```

A 201 body looks like `{ "movementId": "25HRA0B2", "validation": { "warnings": [] } }`. Use that `movementId` on collection, delivery and fate-of-waste calls.

## Design notes (why, not what)

The edge is a REST API, not HTTP API, because API keys and usage plans only exist on REST (v1). The JWT is checked at the gateway so Lambdas never call Cognito per request; a later Defra identity issuer replaces the authorizer, not the handlers.

EVENT items are append-only. DynamoDB can `UpdateItem`; we do not, so the legal trail cannot be overwritten. PUTs snapshot CURRENT into the history table first. Public IDs are year-prefixed [sqids](https://sqids.org/) from an atomic DynamoDB counter (`25HRA0B2`) and are opaque to callers.

Firehose lands the raw envelope as bronze JSON (nested `payload`). A later Glue job writes silver Parquet. Do not convert at ingest: a Glue schema at write time drops records when OpenAPI evolves.

Charging is isolated behind SQS and a DLQ. One movement event writes one ledger line (a placeholder tariff) until a statutory per-event fee is confirmed. The £26 annual fee is the same operator ledger, written at onboarding and yearly — not in this slice.

## Out of scope

This slice does not include WAF or Shield, a private API and VPC, GOV.UK One Login, GOV.UK Pay, regulatory BI dashboards, or spreadsheet upload.
