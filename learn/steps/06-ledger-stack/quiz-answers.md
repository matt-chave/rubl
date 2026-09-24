# Step 06 answers

1. A legal event uses sort key `EVENT#<time>#<type>#<uuid>`. The live snapshot uses `CURRENT`.
2. The OpenAPI PUT rule is to keep a revision history. Snapshotting CURRENT into the history table first means a PUT cannot silently overwrite the only copy.
3. DynamoDB `ADD` on the sequence table, then sqids plus a year prefix. That stays unique under concurrent POSTs.
4. The Pipe in step 08 reads the stream. The stream is a property of the table, so it belongs in Ledger even before HTTP exists.
5. `UpdateItem` — in-place mutation of the event history.
