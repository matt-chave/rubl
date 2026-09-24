# Step 02b answers

1. In this repo, reporting a waste movement is create, then collect, then deliver, then receive, then fate-of-waste, all through the vendor REST API. Neighbouring DWTS work that is out of scope includes spreadsheet upload, GOV.UK One Login, international TFS, regulator BI, and GOV.UK Pay / the annual subscription.
2. If the Lambda wrote DynamoDB and also called `PutEvents`, one of those writes could succeed while the other failed, and the lake would miss a legally stored movement. DynamoDB Streams publish the EVENT after it exists.
3. Usage plans and API keys exist on REST (v1), not HTTP API. We need the JWT and `x-api-key` together.
4. EventBridge fans one durable write out to many subscribers (Kinesis for the lake, SQS for charging) without the API Lambda knowing those consumers.
5. The POST should still return success. SQS, fed by an EventBridge rule, isolates charging; the DLQ and alarm are how a missed payment line is noticed.
