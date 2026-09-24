# Step 05b answers

1. They receive an organisation profile plus an API Gateway API key (returned once with `operatorId`). They do not receive an AWS account, an IAM user, a Cognito login, or GOV.UK One Login in this slice.
2. Onboarding owns operator registration. The movements ledger is for waste events, not signup profiles. Separating them keeps billing and lake fan-out off the registration path and matches team boundaries.
3. No. The usage plan exists, but `DwtApi` is not deployed until lesson 7. That lesson attaches `dwt-operators` to the movements stage. Until then the key is issued but cannot reach `POST /movements`.
4. API Gateway already authenticated the key. The Lambda reads `apiKeyId` from the request context and looks it up on the Operators table (`byApiKeyId`). It does not HTTP-call the onboarding API. The sandbox key still maps via `SANDBOX_API_KEY_ID` to `OP-SANDBOX-1`.
5. Widgets are embeddable UI. Secrets belong on the host page after a successful submit (or in Bruno / a password manager), never in widget source or git. The widget only emits `dwt-submit`.
