# Step 03 answers

1. Any of: `apiCode`, `plannedCollectionTime`, `producer`, `intendedCarriers`, `wasteItems`.
2. `carrier`, `weight`, and waste items are reused on create, collection, delivery, and receipt. Endpoint-only files would copy those rules.
3. Structural / format / required fields vs lifecycle (deleted, sequence closed, delivery immutable).
4. Nested OpenAPI bodies evolve. Glue/Parquet needs a stable flat schema: envelope columns + `payload` string.
5. Cross-field rules OpenAPI 3.0 cannot express (and anything that needs the *current* DynamoDB record).
