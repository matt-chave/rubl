# Step 05 answers

1. **Client credentials** — machine-to-machine, no human browser. Authorization code is for people.
2. Volume and coupling. Central IdPs are sized for human logins. Stateless JWT at the gateway survives IdP outages for the token TTL.
3. Bearer JWT **and** `x-api-key` (usage plan).
4. Password manager / Secrets Manager — not git, not chat.
5. Defra / GOV.UK identity as the JWT issuer; same authorizer pattern, different JWKS.
