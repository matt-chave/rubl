# Step 06 answers

1. `EVENT#<time>#<type>#<uuid>` vs `CURRENT`.
2. The OpenAPI PUT rule: keep a revision history; do not silently overwrite the only copy.
3. DynamoDB `ADD` on the sequence table, then sqids + year prefix.
4. The Pipe in step 08 reads the stream. The stream is a property of the table, so it belongs in Ledger.
5. `UpdateItem` (in-place mutation of history).
