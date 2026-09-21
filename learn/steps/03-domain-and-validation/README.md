# Step 03 — Domain model and payload validation

## What is happening

A vendor POST is a **command**. Step 02b mapped that command onto AWS; here we validate it against the Digital Waste Tracking contract, then persist an event. Two layers:

1. **Structural** — [`src/lib/validation/`](../../../src/lib/validation/) (`NotProvided`, `InvalidFormat`, …)
2. **Lifecycle** — [`src/lib/rules.ts`](../../../src/lib/rules.ts) (cannot collect a deleted movement)

The OpenAPI file *defines* the payload. TypeScript *enforces* a working subset. The spec `$ref`s the producer JSON Schema under [`openapi/event-model/`](../../../openapi/event-model/); we do not compile AJV from YAML in this step.

Validation is split by **data group** (weight, parties, waste item) then thin **endpoint composers**, so `carrier` is not copied four times.

## Why this is still local

You can reject a bad body without DynamoDB. That is the same reason ingestion must not call billing synchronously.

## Automated check

```bash
npm run learn -- 03
```

Re-runs validation/ID tests and asserts the split modules exist.

## Manual steps

1. Open [`openapi/openapi.yaml`](../../../openapi/openapi.yaml) at `createMovementRequest`. List the `required` fields.
2. Open [`src/lib/validation/operations/movements.ts`](../../../src/lib/validation/operations/movements.ts). Confirm the same field names.
3. Open [`src/lib/validation/index.ts`](../../../src/lib/validation/index.ts). Find `validateOperation`. That is the single function write-operations call (e.g. `validateOperation('createMovement', body)`). They do not import `parties.ts` or the composers directly.
4. In your head: a request with `isDeleted: true` on POST — which layer rejects it? (`rules.rejectCreateDeleteFlag`, errorType `NotAllowed`.)
5. Read the existing Q&A: [Where is the payload defined?](../../qa/index.md)

## Quiz

[`quiz.md`](quiz.md)

## Next

Step 04: which environment you will use (local / mock / AWS).
