# Step 02b quiz

1. What does “report a waste movement” cover in this repo, and name one neighbouring DWTS concern that is **out of scope**?
2. Why does the API Lambda write DynamoDB and **not** also call `PutEvents` on the bus?
3. Why REST API Gateway rather than HTTP API?
4. What job does EventBridge do that DynamoDB alone does not?
5. If the charging stack is down, what should happen to `POST /movements`, and which component makes that possible?
