# Postman — optional GUI (Bruno is primary)

[Postman](https://www.postman.com/) is a desktop (or browser) HTTP client. It does the same job as [Bruno](bruno.md): a JWT, an `x-api-key`, and a JSON body. The tutorial path is **Bruno first** ([step 05](steps/05-auth-stack/README.md) Get token, [step 07](steps/07-api-proving-path/README.md) Create movement). Use this file only if you prefer Postman. It is **not** required for `npm run learn -- 07`. Pick Postman **or** Bruno, not both.

Do not paste client secrets, API keys, or tokens into chat. Do not tick **Share** on a collection that contains secrets.

## Install (macOS)

1. Open [Postman downloads](https://www.postman.com/downloads/), or:

   ```bash
   brew install --cask postman
   ```

2. Open **Postman**. You can skip an account for local use; signing in is optional.
3. Confirm: **New → Collection** exists.

Docs: [Send a request](https://learning.postman.com/docs/sending-requests/create-requests/request-basics/).

## Create an environment

Values come from step 07 collect-outputs / Cognito. Paste from your password manager.

1. **Environments** → **+** → name `dwt-dev`.
2. Add variables (type **default** / **secret** for the last two):

   | Variable | Initial value |
   |---|---|
   | `apiBase` | `ApiBaseUrl` (ends `/dwt`) |
   | `tokenUrl` | `DwtAuth` `TokenUrl` (`…/oauth2/token`) |
   | `clientId` | Cognito app client id (approved software) |
   | `clientSecret` | Cognito app client secret (mark **secret**) |
   | `apiKey` | Operator API key from Secrets Manager (`dwt-operator-sandbox`; mark **secret**) |
   | `token` | leave empty — filled after Get token |

3. Select `dwt-dev` in the environment picker (top right).

## Create a collection

**New → Collection** → name `dwt-sandbox`.

### Request 1 — Get token

Lesson 05: client credentials, not `/movements`.

1. **Add request** → name `Get token` → **POST**.
2. URL: `{{tokenUrl}}`
3. **Authorization** → **Basic Auth** → username `{{clientId}}` → password `{{clientSecret}}`.
4. **Body** → **x-www-form-urlencoded**:

   | Key | Value |
   |---|---|
   | `grant_type` | `client_credentials` |
   | `scope` | `dwt/movements` |

5. **Send**. Status **200**. Copy `access_token` into the environment variable `token` (Environments → `token` → **Current value**). Alternatively **Tests**:

   ```javascript
   pm.environment.set('token', pm.response.json().access_token)
   ```

   Do not paste that value into chat.

### Request 2 — POST /movements

1. **Add request** → name `Create movement` → **POST**.
2. URL: `{{apiBase}}/movements`
3. **Authorization** → **No Auth** (we set the header ourselves). **Headers**:

   | Key | Value |
   |---|---|
   | `Authorization` | `Bearer {{token}}` |
   | `x-api-key` | `{{apiKey}}` |
   | `Content-Type` | `application/json` |

4. **Body** → **raw** → **JSON**. Paste [`learn/fixtures/create-movement.json`](fixtures/create-movement.json).
5. **Send**. Expect **201** and a `movementId`.

## Make it fail (same as step 07.6)

- Duplicate `Create movement`, disable `Authorization` → **401**.
- Duplicate, disable `x-api-key` → **403**.
- Duplicate, body `{}` with both headers → **400** and `validation.errors`.

## If it fails

- **401** on create: run **Get token** again (`token` expires). Confirm `DwtApi` was deployed with `authorizationScopes` (see step 07).
- **403**: empty or wrong operator `apiKey` (not the Cognito secret).
- Empty `apiBase`: must include `/prod/dwt`.
- Postman **OAuth 2.0** helper can replace Get token later (grant type **Client credentials**, Access Token URL `{{tokenUrl}}`, scope `dwt/movements`). The two-request version above matches the curl exactly.
