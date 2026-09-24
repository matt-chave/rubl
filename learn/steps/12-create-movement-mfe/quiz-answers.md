# Step 12 answers

1. They are meant to be dropped into someone else’s product. That host already has (or must not be given) DWT secrets. The widgets are UI and local validation; the host owns submit.
2. The software Cognito client secret (to mint the JWT) and the operator API key issued at onboarding. The BFF forwards `Authorization` and `x-api-key`.
3. The `dwt-producer` element fires a bubbling `dwt-change` CustomEvent whose detail contains the `producer` slice. The host listens; it does not scrape the form.
4. No. They must reserve IDs while online first. That is the same product rule as step 11’s circulation cap.
5. The reserved `movementId` that was stored with the queued mutation. The server claims that reservation; it does not mint a second id.
6. No. One Login is still out of scope. The operator was already onboarded. The BFF uses the operator API key the operator would otherwise paste into vendor software.
