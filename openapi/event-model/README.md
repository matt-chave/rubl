# Vendored DEFRA event-model schemas

Pinned snapshot of the JSON Schema files that [`../openapi.yaml`](../openapi.yaml) `$ref`s.

**Upstream:** [DEFRA/digital-waste-tracking-api-docs](https://github.com/DEFRA/digital-waste-tracking-api-docs)  
**Path:** `docs/event-model/schema/common/producer/`  
**Commit:** [`af602c1585f29cc45142fc257c8fb0bf0e0a5273`](https://github.com/DEFRA/digital-waste-tracking-api-docs/commit/af602c1585f29cc45142fc257c8fb0bf0e0a5273) (2026-09-18)

This is the `$ref` closure only — not the rest of the DEFRA docs site. Upstream the YAML lives in `docs/api/`, so their `$ref` is `../event-model/...`. Here the YAML lives in `openapi/`, so that path is rewritten to stay next to the spec:

```
producer:
  $ref: './event-model/schema/common/producer/producer.schema.json'
```

`producer.schema.json` is a `oneOf` of household / commercial / municipal. Those files `$ref` `producer-base.schema.json`. There are no further file `$ref`s.

Runtime validation is still the hand-written subset in [`src/lib/validation/parties.ts`](../../src/lib/validation/parties.ts). Notable pin vs subset: the vendored base schema **requires** `councilMovement`; `validateProducer` does not yet. Treat differences as a later alignment task, not as a reason to delete the snapshot.

To refresh later: replace these five files from the same upstream path and update the commit above.
