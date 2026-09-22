# Bruno — GUI for steps 07 and 10

[Bruno](https://www.usebruno.com/) is a desktop HTTP client. It does the same job as `curl`: JWT + `x-api-key` + JSON body. Step 07 can still use curl; [step 10](steps/10-remaining-and-prod/README.md) walks the full journey in Bruno first (curl is the alternative there). Pick Bruno **or** [Postman](postman.md), not both.

Do not paste client secrets, API keys, or tokens into chat.

## Install (macOS)

1. Open the [Bruno downloads](https://www.usebruno.com/downloads) page, or:

   ```bash
   brew install --cask bruno
   ```

2. Open **Bruno** from Applications.
3. Confirm: **File → New Collection** exists.

Docs: [Bruno documentation](https://docs.usebruno.com/).

## Create a collection

1. **Create Collection** → name `dwt-sandbox` → save it **outside** this git repo (or add `*.bru` secrets to `.gitignore` if you insist on saving next to the code). Do not commit secrets.
2. Right-click the collection → **Settings** / **Environments** → **Create Environment** → name `dev`.
3. Open the environment picker (top right) → **Configure** → `dev`. Add a row per variable (**Name** / **Value**). Values come from step 07 collect-outputs / Cognito — paste from your terminal or password manager, not from chat. Tick **Secret** for `clientSecret` and `apiKey` if Bruno offers it:

   | Name | Value |
   |---|---|
   | `apiBase` | `ApiBaseUrl` (ends `/dwt`) |
   | `tokenUrl` | `DwtAuth` `TokenUrl` (`…/oauth2/token`) |
   | `clientId` | Cognito app client id |
   | `clientSecret` | Cognito app client secret |
   | `apiKey` | Secrets Manager API key (not the Cognito secret) |
   | `token` | leave empty — filled after Get token |
   | `movementId` | leave empty — filled after Create movement (step 10) |
   | `deliveryId` | leave empty — filled after Record delivery (step 10) |

4. Select environment **dev** in the top-right.

## Request 1 — Get token

This is lesson 05: client credentials, not `/movements`.

1. New request → name `Get token` → method **POST**.
2. URL: `{{tokenUrl}}`
3. **Auth** → **Basic** → username `{{clientId}}` → password `{{clientSecret}}`.
4. **Body** → **Form URL encoded**:

   | Key | Value |
   |---|---|
   | `grant_type` | `client_credentials` |
   | `scope` | `dwt/movements` |

5. **Send**. Status **200**. Body has `access_token` (a long `eyJ…` string).
6. Copy `access_token` into the environment variable `token` so request 2 can use `{{token}}`. On the **Tests** tab you can set:

   ```javascript
   const body = typeof res.getBody === "function" ? res.getBody() : res.body;
   const parsed = typeof body === "string" ? JSON.parse(body) : body;
   if (parsed && parsed.access_token) {
     bru.setEnvVar("token", parsed.access_token);
   }
   ```

   Do not screenshot it.

## Request 2 — POST /movements

1. New request → name `Create movement` → method **POST**.
2. URL: `{{apiBase}}/movements`
3. **Headers**:

   | Header | Value |
   |---|---|
   | `Authorization` | `Bearer {{token}}` |
   | `x-api-key` | `{{apiKey}}` |
   | `Content-Type` | `application/json` |

4. **Body** → **JSON**. Paste the contents of [`learn/fixtures/create-movement.json`](fixtures/create-movement.json) (not the secrets).
5. **Send**. Expect **201** and a `movementId`.

The rest of the journey (collection → delivery → receipt → fate → EWC) is click-by-click in [step 10](steps/10-remaining-and-prod/README.md): duplicate **Create movement**, keep `Authorization: Bearer {{token}}` and `x-api-key: {{apiKey}}`, change the URL and body, and use `bru.setEnvVar` for `movementId` / `deliveryId`.

## Make it fail (same as step 07.6)

- Duplicate `Create movement`, delete the `Authorization` header → **401**.
- Duplicate, delete `x-api-key` → **403**.
- Duplicate, body `{}` with both headers → **400** and `validation.errors`.

## If it fails

- **401** on create with a token: mint a new token (it expires). Confirm `DwtApi` was deployed with `authorizationScopes` (see step 07).
- **403**: wrong or empty `apiKey`.
- Empty `apiBase`: it must include `/dwt` and `/prod`.
