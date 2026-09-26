# Step 12 — Create-movement micro frontends

## What is happening

Approved software does not have to be a third-party product. This lesson adds a **first-party GOV.UK operator app** that a waste operator can use instead, plus the same screens as **widgets** a third-party app can drop into its own journey.

The widgets are React and TypeScript, compiled to **Web Components** (`dwt-producer`, `dwt-carriers`, `dwt-waste-items`, `dwt-review-submit`). They own a slice of [`createMovementRequest`](../../../openapi/openapi.yaml) and fire `dwt-change`, `dwt-valid`, and `dwt-submit`. They do **not** hold the operator API key or the software client secret, and they do not call API Gateway. The **host** owns transport.

The first-party host is [`apps/dwt-operator-ui`](../../../apps/dwt-operator-ui). A small local **BFF** ([`apps/dwt-bff`](../../../apps/dwt-bff)) mints the software JWT and forwards `x-api-key`. TanStack Query in [`packages/dwt-operator-client`](../../../packages/dwt-operator-client) reserves movement IDs (step 11), submits `POST /movements`, and keeps an offline queue in IndexedDB. If the radio is down and IDs were reserved while online, the driver can still finish the form; we send the queued event when the connection returns.

This lesson only builds **Create movement**. Collection, delivery, receipt, and fate are later tags.

```
Operator (browser)     Third-party host
        │                     │
        ▼                     ▼
  GOV.UK shell          <dwt-producer /> …
        │                     │
        └────────┬────────────┘
                 ▼
        TanStack Query + offline queue
                 ▼
        Local BFF (secrets stay here)
                 ▼
        DwtApi  JWT + operator API key
```

[GOV.UK Design System](https://design-system.service.gov.uk/) and [GOV.UK Frontend](https://frontend.design-system.service.gov.uk/) supply the look. We output official class names (`govuk-input`, `govuk-button`, `govuk-error-summary`). This is not GOV.UK One Login; the operator was already onboarded and gave their API key to the BFF the same way they would give it to a vendor.

## Where the code is

| Piece | Path |
|---|---|
| GOV.UK wrappers | [`packages/dwt-govuk`](../../../packages/dwt-govuk) |
| Create-movement widgets + custom elements | [`packages/dwt-mfe-create-movement`](../../../packages/dwt-mfe-create-movement) |
| BFF client, reserved-ID store, queue | [`packages/dwt-operator-client`](../../../packages/dwt-operator-client) |
| Local BFF | [`apps/dwt-bff`](../../../apps/dwt-bff) |
| First-party service | [`apps/dwt-operator-ui`](../../../apps/dwt-operator-ui) |
| Third-party-style assembly | [`apps/dwt-widget-demo`](../../../apps/dwt-widget-demo) |

Root [`package.json`](../../../package.json) is an npm workspace (`apps/*`, `packages/*`). Lambda and CDK scripts are unchanged.

## Why the host owns the API

The DWT write path still needs a Cognito **client secret** and an **operator API key** (steps 05 and 07). Those are secrets DWT issued. A widget that a third party embeds must not contain them. The BFF is approved software for this workshop (it reuses `dwt-vendor-software`). Production would give the first-party app its own client so EVENTs record a distinct `softwareApplicationId`. There is still no pairing grant: any approved software plus a valid operator key may submit.

## How the shell ties widgets to Digital Waste Tracking

The widgets stop at events. The first-party shell is what actually calls the API, through the BFF so the browser never sees `CLIENT_SECRET` or `API_KEY`.

When you open the task list or the review page, [`App.tsx`](../../../apps/dwt-operator-ui/src/App.tsx) calls `useEnsureReservedIds`. That hook lives in [`packages/dwt-operator-client/src/hooks.ts`](../../../packages/dwt-operator-client/src/hooks.ts). It asks the queue store whether enough unused movement IDs remain; if not, and the browser is online, it `POST`s `/bff/id-reservations`. Vite proxies that path to [`apps/dwt-bff/src/server.ts`](../../../apps/dwt-bff/src/server.ts), which mints a Cognito client-credentials JWT, attaches the operator `x-api-key`, and forwards to `POST {API_BASE}/id-reservations` on `DwtApi`. The returned IDs sit in IndexedDB for offline use — an ordinary online submit does not consume them.

On each form page, [`WidgetHost.tsx`](../../../apps/dwt-operator-ui/src/WidgetHost.tsx) mounts a custom element from [`packages/dwt-mfe-create-movement/src/elements.tsx`](../../../packages/dwt-mfe-create-movement/src/elements.tsx) and listens for `dwt-change`, `dwt-valid`, and `dwt-submit`. Producer, carriers, and waste items update shell state on change and return to the task list on valid. The review widget is different: confirm fires `dwt-submit` with the assembled `createMovementRequest` body. The shell’s `onSubmit` handler calls `useSubmitMovement`, which runs `submitOrQueue` in [`packages/dwt-operator-client/src/queue.ts`](../../../packages/dwt-operator-client/src/queue.ts). Online, that `POST`s `/bff/movements` **without** a `movementId`; the API mints a new public id and returns it, and the reserved pool is left alone. Offline, `submitOrQueue` takes one reserved id, attaches it as `movementId`, and queues the body in IndexedDB (no fetch). When `online` fires or the operator clicks **Send queued movements**, flush sends that same reserved `movementId` so the API claims the reservation. In both online and flush paths the BFF adds Bearer JWT plus `x-api-key` and proxies to `POST {API_BASE}/movements`.

The review and confirmation screens spell this out in the UI so you can see queued versus submitted and the movement id without opening the network tab. Tokens and API keys are never logged. The widget-demo app at port 5175 deliberately does **not** call DWT; a vendor would map the same events onto their own credentials.

## Automated check

Complete [step 11](../11-offline-ids/README.md) first. The runner will refuse this step otherwise.

```bash
npm run learn -- 12
```

Confirms the workspace packages exist, the four custom element tags are registered in source, GOV.UK class names are used, reserved-ID / queue unit tests pass, and step 11’s reservation code is still in the tree. It does not start Vite or deploy a new stack.

## Manual steps — first-party app

### 0. Install workspace packages

From the **repo root** (`rubl/`), after a pull that added `apps/` and `packages/`:

```bash
npm install
```

### 1. Point the BFF at the sandbox

Copy [`apps/dwt-bff/.env.example`](../../../apps/dwt-bff/.env.example) to `apps/dwt-bff/.env.local`. Fill `API_BASE`, `TOKEN_URL`, `CLIENT_ID`, `CLIENT_SECRET`, and `API_KEY` from Bruno `dwt-sandbox` / `dev` (the same values as steps 05 and 07). Tick Secret in Bruno; do not paste those values into chat.

### 2. Run the BFF and the GOV.UK service

Two terminals, repo root:

```bash
npm run bff
npm run ui
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Walk **Start now** → producer → carriers → waste items → review and submit. On review, read **What happens when you submit** — that is the shell-to-BFF path in plain language. After confirm, the done page shows queued versus submitted and the movement id. If the BFF can reach `DwtApi` while you are online, submit omits `movementId` and the API returns a freshly minted id; the reserved pool count should not drop. If you toggle the browser offline after IDs were reserved, submit takes one reserved id, queues the body, and flush claims that reservation when you go online.

### 3. Assemble widgets in another page

```bash
npm run widget-demo
```

Open [http://127.0.0.1:5175](http://127.0.0.1:5175). That page is not the operator shell. It only mounts `dwt-producer` and `dwt-waste-items` and logs `dwt-change`. A vendor would map those events onto their own submit path. Port 5174 is the onboarding host from lessons 5 and 5b.

## Alternative — read the widgets without running Vite

If you cannot run the UI, open [`packages/dwt-mfe-create-movement/src/elements.tsx`](../../../packages/dwt-mfe-create-movement/src/elements.tsx) and [`packages/dwt-operator-client/src/queue.ts`](../../../packages/dwt-operator-client/src/queue.ts). Confirm the four tags, the `dwt-*` events, that online submit omits `movementId`, and that offline submit attaches a reserved `movementId` and does not fetch. Then run the automated check.

## Quiz

[`quiz.md`](quiz.md)

## Save your work (GitHub)

From the **repo root** (`rubl/`). Why and what not to commit: [`learn/commit.md`](../../commit.md). Do not commit `.env.local`.

```bash
git status
git add -A
git status
git commit -m "learn: complete step 12 — create-movement micro frontends"
git push
```

`nothing to commit` is fine if you only read.
