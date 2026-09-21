# Step 02b answers

1. Create → collect → deliver → receive → fate-of-waste, via the vendor REST API. Out of scope examples: spreadsheet upload, GOV.UK One Login, international TFS, regulator BI, GOV.UK Pay / annual subscription.
2. Dual-write: DynamoDB can succeed and the bus can fail, so the lake would miss a legally stored movement. Streams publish **after** the EVENT item exists.
3. Usage plans and API keys exist on REST (v1), not HTTP API. We need JWT **and** `x-api-key`.
4. Fan-out: many subscribers (Kinesis/lake, SQS/charging) from one durable write, without the API Lambda knowing those consumers.
5. The POST should still return success. SQS (fed by an EventBridge rule) isolates charging; the DLQ/alarm is how a missed payment line is noticed.
