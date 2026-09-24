# Step 05 answers

1. Vendor systems use the client-credentials grant: machine-to-machine, with no human browser. The authorization-code grant is for people.
2. Volume and coupling. Central identity providers are sized for human logins. A stateless JWT check at the gateway survives an IdP outage for the remaining token lifetime.
3. A Bearer JWT (approved software) and `x-api-key` (the operator API key issued at onboarding; sandbox: `dwt-operator-sandbox`).
4. A password manager or Secrets Manager — not git, not chat, and not inside the widget. Signup returns the secret once; DynamoDB stores only the client id.
5. Defra / GOV.UK identity as the JWT issuer, with the same authorizer pattern and a different JWKS.
6. It registers software and issues a Cognito app client. It does not require an operator key and does not write waste movements. Those routes live on `DwtOnboarding`, not on `DwtApi`.
7. No. The widget emits `dwt-submit`; the host and BFF call the onboarding API. Secrets appear on the host page after success, not in widget source.
