# Step 03 answers

1. Any of `apiCode`, `plannedCollectionTime`, `producer`, `intendedCarriers`, or `wasteItems`.
2. `carrier`, `weight`, and waste items are reused on create, collection, delivery, and receipt. Files split only by endpoint would copy those rules four times.
3. The validation folder checks structure, format, and required fields. `rules.ts` checks lifecycle: a deleted movement, a closed collection sequence, or an immutable delivery.
4. Nested OpenAPI bodies evolve. Firehose Parquet conversion needs a Glue schema at write time and would drop records to `errors/`. Bronze keeps the raw envelope; silver Parquet is a later rebuildable job.
5. Cross-field rules that OpenAPI 3.0 cannot express, and anything that needs the current DynamoDB record.
