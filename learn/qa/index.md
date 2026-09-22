# Q&A index

Template for new entries:

```markdown
## YYYY-MM-DD — short title

**Step:** NN (or "cross-cutting")

**Q:** …

**A:** …

**Code:** `path/to/file`
```

---

## 2026-09-18 — Where is the payload defined and validated?

**Step:** 03

**Q:** Where do we define the contents of the payload and validate it? Does that code exist?

**A:** The *contract* is [`openapi/openapi.yaml`](../../openapi/openapi.yaml) (e.g. `createMovementRequest`). Runtime checks are hand-written TypeScript under [`src/lib/validation/`](../../src/lib/validation/), not AJV compiled from the YAML — the spec $refs an external producer schema we do not vendor. `validateOperation` is the single entry point. The EventBridge envelope field `payload` is that same accepted body as a JSON object (bronze stores it as-is; silver Parquet is a later Glue job).

**Code:** `src/lib/validation/index.ts`, `src/lib/operations/movements.ts`

---

## 2026-09-18 — Should validation.ts be split?

**Step:** 03

**Q:** validations.ts is quite a meaty file. Should it not be split by logical data groups and/or endpoints?

**A:** Yes. Split by **shared data groups first** (weight, parties, waste item), then thin composers per endpoint family. Do not split only by endpoint or you copy `carrier` four times. Lifecycle rules stay in `rules.ts`.

**Code:** `src/lib/validation/`

---

## 2026-09-19 — Where is cdk.out/DwtLedger.template.json?

**Step:** 02

**Q:** Where do I find `cdk.out/DwtLedger.template.json`?

**A:** At the **repo root**, not under `infra/` or `learn/`. Full path: `rubl/cdk.out/DwtLedger.template.json`. CDK writes all synthesised CloudFormation there when you run `npx cdk synth` or `npm run learn -- 02`. The folder is in `.gitignore` because it is generated; Cursor may hide it from source control. Open it from the file explorer or `open cdk.out/DwtLedger.template.json`. Sibling files: `DwtAuth`, `DwtEvents`, `DwtCharging`, `DwtApi`.

**Code:** `cdk.out/DwtLedger.template.json` (generated), `infra/lib/stacks/ledger-stack.ts` (source)

---

## 2026-09-19 — What's an AJV?

**Step:** 03

**Q:** What's an AJV?

**A:** AJV (Another JSON Schema Validator) is a Node.js library that takes a JSON Schema and compiles it into a fast `validate(data)` function. You could feed it the OpenAPI request schemas and reject bodies that do not match. This repo does **not** use AJV today: the DEFRA spec `$ref`s an external producer schema, so we cannot compile the YAML as-is. Instead [`src/lib/validation/`](../../src/lib/validation/) is a hand-written subset of those rules. AJV would replace the structural checks; [`src/lib/rules.ts`](../../src/lib/rules.ts) would still be needed for lifecycle rules that need DynamoDB.

**Code:** `src/lib/validation/index.ts` (comment at top)

---

## 2026-09-19 — When would you use AJV and why not here?

**Step:** 03

**Q:** When would you use an AJV and why not here?

**A:** Use AJV when the JSON Schema / OpenAPI request body is self-contained and you want the *running API* to reject anything the contract forbids (extra fields, wrong types, enums) without re-implementing those rules in TypeScript. You compile the schema at build or cold start; every request is a fast function call. That is the right default for a stable vendor API.

Not here for three reasons: (1) `createMovementRequest.producer` `$ref`s `../event-model/schema/common/producer/producer.schema.json`, which is not in this repo, so AJV cannot resolve the spec. (2) Many waste rules need the *current DynamoDB record* (deleted? collection closed?) — JSON Schema cannot see that; `rules.ts` must stay. (3) The tutorial values readable, commented TypeScript over a compiled schema you cannot step through. AJV can be added later once the producer schema is vendored; `validateOperation` is the swap point.

**Code:** `openapi/openapi.yaml` (`producer` $ref), `src/lib/validation/`, `src/lib/rules.ts`

---

## 2026-09-19 — Split OpenAPI into smaller YAML files?

**Step:** 03

**Q:** Could openapi.yaml be separated into smaller YAML files referenced from one root file? Would that be clearer if each entity is referred to rather than embedded?

**A:** Yes, OpenAPI `$ref` can point at other files (`./schemas/weight.yaml#/Weight`). A good split is one file per *entity family* (ids, weight, parties, waste-item, movement, collection, delivery, receipt, paths) — the same cuts as `src/lib/validation/`. A root `openapi.yaml` keeps `info`, `servers`, `security`, and `$ref`s only.

Do it only if every `$ref` lives **in this repo** and you add a **bundle** step (`redocly bundle` or similar) that writes one `openapi.bundle.yaml` for Swagger UI, vendors, and a future AJV compile. The current spec already `$ref`s an *external* producer JSON Schema we did not vendor — that is why AJV cannot run. Splitting without bundling would make that worse. Do not split down to one file per field.

**Code:** `openapi/openapi.yaml`, `src/lib/validation/`

---

## 2026-09-19 — Why isn't producer.schema.json in the repo?

**Step:** 03

**Q:** Why isn't `../event-model/schema/common/producer/producer.schema.json` in this repo?

**A:** It lives in the *upstream DEFRA docs repo*, not in a missing sibling of this workshop. DEFRA keep the REST spec at `docs/api/openapi.yaml` and the event-model JSON Schemas next to it at `docs/event-model/`. The `$ref` is a *relative path from the YAML's original folder*, so in DEFRA's tree it resolves. This workshop originally vendored only the OpenAPI file into `openapi/openapi.yaml` (plus a local security overlay).

**Update 2026-09-19:** the `$ref` closure is now pinned under [`openapi/event-model/`](../../openapi/event-model/). Runtime producer checks remain the hand-written subset in `src/lib/validation/parties.ts`.

**Code:** `openapi/openapi.yaml` line 739, `openapi/event-model/`, `src/lib/validation/parties.ts`

---

## 2026-09-19 — Should we vendor the DEFRA files the OpenAPI $refs?

**Step:** 03

**Q:** Why wouldn't we copy the referenced DEFRA files here too? We copied openapi.yaml, so we should have the files it points at — even just as a snapshot of what we are building against if DEFRA's OpenAPI changes.

**A:** We should. Leaving a dangling `$ref` was a tutorial shortcut (one YAML + hand-written TypeScript), not a good contract practice. Vendoring the referenced schemas pins the producer shape this implementation was built against; later DEFRA edits become a diff, not a silent drift.

Copy the **`$ref` closure**, not the whole DEFRA docs estate. Today that is five JSON files under `docs/event-model/schema/common/producer/` (`producer.schema.json` plus household / commercial / municipal / base). Place them so the existing relative path still resolves (e.g. `openapi/event-model/schema/common/producer/`), and record the upstream commit or date. That makes the contract self-contained and unblocks a later AJV compile. It does not replace `rules.ts` (lifecycle still needs DynamoDB) and does not mean we start compiling AJV in this step.

**Code:** `openapi/openapi.yaml` line 739, `src/lib/validation/parties.ts`

---

## 2026-09-19 — Why is openapi.yaml red with 2 problems?

**Step:** 03

**Q:** The openapi.yaml file is red reporting 2 problems. What are these?

**A:** The YAML language server validates the file against the OpenAPI 3 schema (`openapi.json`). That schema only allows root keys such as `openapi`, `info`, `servers`, `paths`, `components`. Lines 1 and 4 are a local banner, not comments:

- L1 `Source URL: …` — property `Source URL` is not allowed
- L4 `Title: =====` — property `Title` is not allowed

The `#` lines under them are fine (YAML comments). The `$ref` to `./event-model/` is not one of the two errors. Prefix those two banner lines with `#` if you want the red markers gone; it does not change runtime behaviour.

**Code:** `openapi/openapi.yaml` lines 1 and 4

---

## 2026-09-19 — What is "the only function operations import"?

**Step:** 03

**Q:** Manual step 3 says "This is the only function operations import." What is the only function? What am I looking at? Why is this important?

**A:** `validateOperation` in `src/lib/validation/index.ts`. A write-operation such as `createMovement` calls `validateOperation('createMovement', body)` and does not import `validateMovementPayload` or `parties.ts`. The switch inside `validateOperation` routes to the right composer.

That single door matters for two reasons. (1) Every endpoint speaks the same validation vocabulary (`NotProvided`, `InvalidFormat`, …) and throws `ValidationError` the same way. (2) You can later replace the switch with AJV without touching Lambdas or `src/lib/operations/*`. Lifecycle checks stay in `rules.ts` and are called separately (`rejectCreateDeleteFlag`).

Some operations also import `movementIsHazardous` from the same file — that is a helper, not a second validator.

**Code:** `src/lib/validation/index.ts`, `src/lib/operations/movements.ts`

---

## 2026-09-19 — Where is the git repo and how do I share it?

**Step:** 04b (cross-cutting)

**Q:** I'm a bit lost on git / GitHub. Where is the code repository for this project? How do I make it externally available to other people?

**A:** The project folder is `~/projects/rubl`. Follow [step 04b](../steps/04b-share-the-repo/README.md): `git init`, first commit (`.gitignore` already excludes `node_modules` and `.env`), empty GitHub repo, `git remote add origin`, `git push`. Do not commit AWS keys or `cdk.out`.

**Code:** `learn/steps/04b-share-the-repo/README.md`, `.gitignore`

---

## 2026-09-19 — Git lesson in step 01 or its own step?

**Step:** 04b

**Q:** Can you include setting up a repo so it is available for other people to work on and clone? Part of lesson 1, or a lesson on its own?

**A:** Its own step, **04b**, after environments and before AWS. Step 01 stays “does the laptop run the tests.” Git/GitHub is a different skill (backup and collaboration). 04 already talks about one codebase and four environments; 04b is what makes that codebase shareable. It is still local (no AWS). The runner now requires 04b before 05.

**Code:** `learn/steps/04b-share-the-repo/README.md`

---

## 2026-09-19 — Architecture lesson for report-a-waste-movement?

**Step:** 02b

**Q:** We probably need a lesson on the architecture and the scope of report a waste movement. It should cover why we are using the AWS components and how they support the requirements. Overview of each component: what it does and why.

**A:** Its own step, **02b**, after synth and before validation. Step 02 shows the five templates; 02b explains the domain journey (create → collect → deliver → receive → fate), what is out of scope, and a what/why for each AWS component. The durable note is `learn/architecture.md`. If you already completed 03, run `npm run learn -- 02b` anyway (step 02 is done so it is unlocked).

**Code:** `learn/architecture.md`, `learn/steps/02b-architecture/README.md`

---

## 2026-09-19 — How do I set up AWS dev? What users do I create?

**Step:** 04

**Q:** I want AWS `dev` from step 4 but I am not sure how to set this up. I need instructions as part of step 4. What users should I create — or are you doing that? I do not understand `aws configure sso` vs `aws configure` with a named profile.

**A:** Cursor does **not** create AWS accounts or IAM users. You do. One sandbox **account** (12-digit billing container) plus one **human** login: either an IAM user with access keys (`aws configure --profile dwt-dev`) or work IAM Identity Center (`aws configure sso` then `aws sso login`). A named profile is only a label in `~/.aws/` so `export AWS_PROFILE=dwt-dev` aims CDK at the sandbox. Do not create carrier/producer IAM users — Cognito app clients come from step 05 CDK. Do not use root keys. Full walkthrough: `learn/aws-dev-setup.md`. Never paste keys or `get-caller-identity` JSON into chat.

**Code:** `learn/aws-dev-setup.md`, `learn/steps/04-environments/README.md`

---

## 2026-09-19 — Link AWS Console pages in the tutorial

**Step:** 04

**Q:** Whenever you refer to parts of AWS can you provide links? (Example: Billing → Budgets.)

**A:** Yes. Console and docs URLs now sit next to those names. The Budgets example is [Billing → Budgets](https://console.aws.amazon.com/billing/home#/budgets) ([create a budget](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-create.html)). Regional services use `eu-west-2` console links. Future tutorial text should keep doing this (`aws-console-links.mdc`).

**Code:** `learn/aws-dev-setup.md`, `.cursor/rules/aws-console-links.mdc`

---

## 2026-09-19 — I already have a user; how do I check and change permissions?

**Step:** 04

**Q:** I already have a user — how do I check and change the permissions?

**A:** In [IAM → Users](https://console.aws.amazon.com/iam/home#/users) open the user → **Permissions**. Rights come from attached policies, groups, and (rarely) a permissions boundary. For this sandbox you want `AdministratorAccess` on the user or a group. Add it with **Add permissions → Attach policies directly**, or `aws iam attach-user-policy --user-name NAME --policy-arn arn:aws:iam::aws:policy/AdministratorAccess`. You need root or another admin if this user cannot edit IAM. Work SSO users are different: change the Identity Center **permission set**, not an IAM user. Do not grant admin on a production account.

**Code:** `learn/aws-dev-setup.md` (Already have an IAM user?)

---

## 2026-09-19 — I don't know my secret access key

**Step:** 04

**Q:** I don't know what my secret access key is. How do I find it? Do I need a new one?

**A:** You cannot look it up. AWS shows the secret **once** when the key is created. Check a password manager and `~/.aws/credentials` on this laptop. If it is gone, create a **new** access key on the same IAM user (not a new user): [IAM → Users](https://console.aws.amazon.com/iam/home#/users) → Security credentials → Create access key. Max two keys per user; delete an unused one if both slots are full. Then `aws configure --profile dwt-dev` again. Never paste the secret into chat. SSO users do not use this key at all (`aws sso login`).

**Code:** `learn/aws-dev-setup.md` (Create access keys)

---

## 2026-09-19 — How do I copy into a password manager?

**Step:** 04

**Q:** How do I copy into a password manager?

**A:** On the AWS retrieve-keys page, use the copy icon next to each value. Create a new item in Apple Passwords, 1Password, or Bitwarden. Put the secret in the password field, the `AKIA…` id and IAM user name in notes/username, title it something like `AWS dwt-dev IAM`. Save *before* you click Done in AWS. Then paste into `aws configure`. Not Notes, chat, or a screenshot.

**Code:** `learn/aws-dev-setup.md` (How to copy into a password manager)

---

## 2026-09-21 — git push in step 04b was rejected

**Step:** 04b

**Q:** Manual step 6 in 04b did not work. How do I fix it, and can the instructions be updated so it works?

**A:** `git push -u origin main` was rejected because GitHub’s `main` already had a commit (`fetch first`). That means the GitHub repo was not empty (README *or license* on create) or `origin` pointed at another existing repo. `git remote set-url` with the same URL does nothing. Check with `git ls-remote --heads origin` — any `refs/heads/main` means not empty. Example: `matt-chave/rubl` had no README but GitHub still committed `LICENSE` (GPL-3.0). Fix: `git push -u origin main --force` only if that stub is disposable; otherwise create a truly empty repo (no license either).

**Code:** `learn/steps/04b-share-the-repo/README.md` (manual steps 5–6)

---

## 2026-09-21 — Do I create Cognito users or a user pool before step 05?

**Step:** 05

**Q:** In step 05, don't I have to create users first? I don't have any user pools yet.

**A:** Correct — the [Cognito → User pools](https://eu-west-2.console.aws.amazon.com/cognito/v2/idp/user-pools?region=eu-west-2) list should still be empty. Do **not** create a pool or people in the console. `npx cdk deploy DwtAuth` creates User Pool `dwt-vendor-m2m`, app client `dwt-vendor-software`, scope `dwt/movements`, and the hosted domain for `/oauth2/token`. Vendors are machines: OAuth2 **client credentials** (`client_id` + `client_secret`), not Cognito usernames. The only human login you already needed is the IAM/SSO identity from step 04, so CDK can deploy.

**Code:** `learn/steps/05-auth-stack/README.md`, `infra/lib/stacks/auth-stack.ts`

---

## 2026-09-21 — Explain the DwtAuth code or link to it

**Step:** 05

**Q:** You need to explain the code in DwtAuth or provide a link to the code whose comments should make it self explanatory.

**A:** `DwtAuth` is [`infra/lib/stacks/auth-stack.ts`](../../infra/lib/stacks/auth-stack.ts), created as `new AuthStack(app, 'DwtAuth', …)` in [`infra/bin/app.ts`](../../infra/bin/app.ts). Step 05 now links that file and asks you to read it before deploy. The file comments state that CDK creates the pool (do not click Create user pool / Create user), that there are no Cognito users, and what each construct is (pool, `dwt/movements` scope, app client with secret, hosted domain for `/oauth2/token`).

**Code:** `learn/steps/05-auth-stack/README.md`, `infra/lib/stacks/auth-stack.ts`

---

## 2026-09-21 — Type of vendor vs the vendors themselves in DwtAuth?

**Step:** 05

**Q:** So are we setting up a type for vendors or the vendors themselves in DwtAuth?

**A:** Both, at different layers. The User Pool `dwt-vendor-m2m` plus resource-server scope `dwt/movements` is the **type** (how machine vendors authenticate). The app client `dwt-vendor-software` is **one** sandbox vendor identity (`client_id` + secret) so you can get a token. It is not a TypeScript type, not Cognito people, and not a registry of real waste companies. Production would `addClient` once per vendor (or product) in the same pool.

**Code:** `infra/lib/stacks/auth-stack.ts`, `learn/steps/05-auth-stack/README.md`

---

## 2026-09-21 — Separate vendor account creation from DwtAuth?

**Step:** 05

**Q:** Should we not separate out the creation of vendor accounts as we will need to run this every time we get a new vendor?

**A:** Yes in production — not in this workshop. `DwtAuth` should keep the **issuer** (pool, domain, `dwt/movements` scope), which changes rarely. Each vendor is a new app client created by IAM (`CreateUserPoolClient`), not another `cdk deploy DwtAuth`. DevEx can request that after conformance; IAM holds the secrets. The single `dwt-vendor-software` client in the stack is a sandbox shortcut so step 05 can get a token. Same smell: one API key baked into `DwtApi`.

**Code:** `infra/lib/stacks/auth-stack.ts`, `learn/steps/05-auth-stack/README.md`

---

## 2026-09-21 — Manual steps vs automated check order on AWS

**Step:** 05 (also 06–09)

**Q:** For manual steps, don't I need to do all the automated checks apart from the last one?

**A:** Yes. Profile, bootstrap, and `cdk deploy` are **manual** work so the console and curl have something to look at. `npm run learn -- 05` is last — it only checks that CloudFormation stack `DwtAuth` exists. Same order on later AWS steps: deploy, look, then the green tick.

**Code:** `learn/steps/05-auth-stack/README.md`, `learn/README.md`

---

## 2026-09-21 — What goes in AWS_PROFILE=your-sandbox?

**Step:** 05

**Q:** What do I put into `export AWS_PROFILE=your-sandbox` as my sandbox?

**A:** The **named profile** from step 04, usually `dwt-dev`. It is a label in `~/.aws/`, not the 12-digit account, not the IAM user `dwt-dev-admin`, and not the word “sandbox”. `your-sandbox` in older step 05 text was a placeholder. List names with `aws configure list-profiles`. Then `export AWS_PROFILE=dwt-dev` and `aws sts get-caller-identity` (do not paste that JSON into chat). SSO: `aws sso login --profile dwt-dev` first.

**Code:** `learn/steps/05-auth-stack/README.md`, `learn/aws-dev-setup.md`

---

## 2026-09-21 — Is `export AWS_PROFILE=dwt-dev` enough?

**Step:** 05

**Q:** `export AWS_PROFILE=dwt-dev`

**A:** That is the correct line **if** you created that named profile in step 04. It only lasts in that terminal. This laptop currently has no `dwt-dev` (`aws configure list-profiles`). Either finish Path A/B in [`learn/aws-dev-setup.md`](../aws-dev-setup.md) (`aws configure --profile dwt-dev` or `aws configure sso --profile dwt-dev`), or export the profile name you actually saved — only if it is the **sandbox**, not a work/prod account. Then `aws sts get-caller-identity` (do not paste the JSON into chat).

**Code:** `learn/steps/05-auth-stack/README.md`, `learn/aws-dev-setup.md`

---

## 2026-09-21 — How do I find the Cognito client id and secret?

**Step:** 05

**Q:** In step 3 of manual steps for lesson 05 — how do I find client id and secret?

**A:** After `cdk deploy DwtAuth`, open [Cognito → User pools](https://eu-west-2.console.aws.amazon.com/cognito/v2/idp/user-pools?region=eu-west-2) in **eu-west-2** → pool `dwt-vendor-m2m` → **App integration** (or **Applications**) → app client `dwt-vendor-software`. Client ID is on that page and as CloudFormation output `ClientId`. Client secret is **Show** / **View client secret** (or `describe-user-pool-client`). CDK never prints the secret. Password manager only — not git or chat.

**Code:** `learn/steps/05-auth-stack/README.md`, `infra/lib/stacks/auth-stack.ts`

---

## 2026-09-21 — What is manual step 4 in lesson 05?

**Step:** 05

**Q:** What is step 4 doing in lesson 05?

**A:** It proves the Cognito **token URL** works. `curl` POSTs to `/oauth2/token` with HTTP Basic (`client_id:client_secret`) and form fields `grant_type=client_credentials` and `scope=dwt/movements`. Cognito returns a JSON body with a JWT `access_token`. You are not calling the waste API yet (that is step 07). Export `CLIENT_ID`, `CLIENT_SECRET`, and `TOKEN_URL` in the same terminal first. The automated check does not run this curl.

**Code:** `learn/steps/05-auth-stack/README.md`

---

## 2026-09-21 — What is a JWT? Is the token an API key?

**Step:** 05

**Q:** Don't understand. What is a JWT? What is this token doing? Is it an API key?

**A:** A JWT is a short-lived signed ticket (`header.payload.signature`) Cognito issues after you prove `client_id` + `client_secret`. It says *who* the vendor software is and *what* it may do (`scope: dwt/movements`) until it expires. API Gateway will check the signature locally (JWKS) — Lambdas do not call Cognito per POST. It is **not** an API key. The API key is a different string (`x-api-key`) for throttle/quota in step 07. The client secret is only used at the token URL, not on `/movements`.

**Code:** `learn/steps/05-auth-stack/README.md`, `learn/architecture.md`

---

## 2026-09-21 — What should I expect from the token curl?

**Step:** 05

**Q:** What should I be expecting to happen here: `TOKEN=$(curl …)` then `echo "$TOKEN" | jq .`?

**A:** Cognito should return JSON with `access_token` (a long JWT starting `eyJ`), `expires_in` (often 3600), and `token_type: Bearer`. `jq` pretty-prints it. Nothing else is created (no table rows, no API call). If `jq` parse-errors, a variable was empty or Cognito returned `invalid_client` / `invalid_scope`. Do not paste the token into chat.

**Code:** `learn/steps/05-auth-stack/README.md`

---

## 2026-09-21 — What should echo $TOKEN show?

**Step:** 05

**Q:** If I do `echo $TOKEN` what should I expect?

**A:** Prefer `echo "$TOKEN"` (quotes). After a successful curl it is the **same** Cognito JSON as `jq` showed, but **one long line**: `{"access_token":"eyJ…","expires_in":3600,"token_type":"Bearer"}`. A blank line means the variable is empty (new terminal, or curl not run). Do not paste it into chat.

**Code:** `learn/steps/05-auth-stack/README.md`

---

## 2026-09-21 — Token curl returns nothing, no errors

**Step:** 05

**Q:** Not coming back with anything. No output. No errors.

**A:** `TOKEN` is empty. `curl -s` hides failures. The usual cause is copying the README placeholder `TOKEN_URL` whose host contains an ellipsis `…` instead of stack output `DwtAuth.TokenUrl` (or `describe-stacks` for `TokenUrl`). Set `TOKEN_URL` from CloudFormation, then `curl -sS …`. A blank `echo "$TOKEN"` is expected until that URL is real.

**Code:** `learn/steps/05-auth-stack/README.md`

---

## 2026-09-21 — Why is the key in terminal history, and how do I rotate?

**Step:** 05 (also 04)

**Q:** Why is it in the terminal history? How do I rotate?

**A:** `aws configure` echoes the access key and secret you type into the **terminal window**. Cursor keeps a transcript of that session, so the secret is on screen even if it is not a `zsh` command. Rotate: [IAM → Users](https://console.aws.amazon.com/iam/home#/users) → Security credentials → Create a **new** CLI access key → save in a password manager → `aws configure --profile dwt-dev` with the new pair → `aws sts get-caller-identity` (do not paste it) → Deactivate then Delete the **old** key. Full click path: [`learn/aws-dev-setup.md`](../aws-dev-setup.md) (Rotate an access key). Do not paste keys into chat.

**Code:** `learn/aws-dev-setup.md`

---

## 2026-09-21 — After rotating the key, echo TOKEN | jq is empty again

**Step:** 05

**Q:** I've rotated the access key but when I do `echo "$TOKEN" | jq .` I get nothing again.

**A:** Expected. `TOKEN` is only in the shell that ran the curl. A new terminal after `aws configure` does not have it. Rotating the IAM key does not issue a JWT. Re-export `CLIENT_ID` and `CLIENT_SECRET`, set `TOKEN_URL` from CloudFormation, curl again, then `echo "$TOKEN" | jq .`. `echo '$TOKEN'` (single quotes) prints the literal `$TOKEN`. Do not paste the JSON into chat.

**Code:** `learn/steps/05-auth-stack/README.md`

---

## 2026-09-21 — Explain DwtLedger code or link to comments

**Step:** 06

**Q:** Again you need to explain what is going on in DwtLedger — plus the comments in there must make it self explanatory.

**A:** `DwtLedger` is [`infra/lib/stacks/ledger-stack.ts`](../../infra/lib/stacks/ledger-stack.ts), created as `new LedgerStack(app, 'DwtLedger', …)` in [`infra/bin/app.ts`](../../infra/bin/app.ts). Step 06 now links that file and asks you to read it before deploy. Comments state CDK creates empty tables (do not click Create table), what PK/SK mean (`EVENT#` vs `CURRENT`), why history/sequences/reference exist, and that real writes are `src/lib/ledger.ts` in step 07.

**Code:** `learn/steps/06-ledger-stack/README.md`, `infra/lib/stacks/ledger-stack.ts`

---

## 2026-09-21 — Why is the movements table named DwtLedger-Movements…?

**Step:** 06

**Q:** The tables have been created but their names are a little weird: movements table is called `DwtLedger-MovementsD0022A57-1FIV79GK7JKHT`.

**A:** Expected. CDK construct id is `Movements`; we did not set `tableName`, so CloudFormation generates `{stack}-{construct}{hash}-{id}` so names stay unique in the account. Lambdas and the CLI use stack output `MovementsTableName` — do not type the hash. You *could* set a friendly `tableName`, but then a later rename replaces the table. Leave the generated name in this sandbox.

**Code:** `infra/lib/stacks/ledger-stack.ts`, `learn/steps/06-ledger-stack/README.md`

---

## 2026-09-21 — PK / SK just say String

**Step:** 06

**Q:** When you say note PK / SK. I can see it but it just says string.

**A:** Correct. The table schema only declares two string keys named `PK` and `SK`. DynamoDB is otherwise schemaless — it does not know `MOVEMENT#` or `CURRENT`. Those prefixes are a convention in [`src/lib/ledger.ts`](../../src/lib/ledger.ts). On an empty table you will not see `EVENT#` rows. After the throwaway PutItem, Explore items should show `PK=LEARN#ping`, `SK=CURRENT`. Real movements appear in step 07.

**Code:** `learn/steps/06-ledger-stack/README.md`, `infra/lib/stacks/ledger-stack.ts`, `src/lib/ledger.ts`

---

## 2026-09-21 — How do I know the movements table has a stream?

**Step:** 06

**Q:** In step 5 — how do I know if it has a stream?

**A:** That is lesson 06 manual step 5 (DynamoDB), not Cognito in 05. Open the `DwtLedger-Movements…` table → **Exports and streams** → **DynamoDB stream details**: enabled, view **New image**. Or `describe-table` / stack output `MovementsTableStreamArn`. History and sequences have no stream. You will not see stream *records* until writes happen; enabled is enough. Step 08’s Pipe uses this.

**Code:** `learn/steps/06-ledger-stack/README.md`, `infra/lib/stacks/ledger-stack.ts`

---

## 2026-09-21 — Explain DwtApi code or link to comments

**Step:** 07

**Q:** Again explain purpose of DwtApi and make sure comments within it make it self explanatory.

**A:** `DwtApi` is the HTTP edge: REST API Gateway, Cognito JWT authorizer, one sandbox API key, `/dwt` prefix, one Lambda per OpenAPI operationId. Source: [`infra/lib/stacks/api-stack.ts`](../../infra/lib/stacks/api-stack.ts) (`new ApiStack(app, 'DwtApi', …)` in [`infra/bin/app.ts`](../../infra/bin/app.ts)). It does not create Cognito or DynamoDB (needs 05 and 06). Lambdas do not `PutEvents`. Step 07 now links the file; comments cover REST vs HTTP API, JWT vs API key, and the sandbox-one-key shortcut.

**Code:** `learn/steps/07-api-proving-path/README.md`, `infra/lib/stacks/api-stack.ts`

---

## 2026-09-21 — Lesson 07 manual step 2 (cdk deploy DwtApi) failed

**Step:** 07

**Q:** Step 2 in manual steps for lesson 07 didn't work.

**A:** `npx cdk deploy DwtApi` failed at synth: [`infra/lib/stacks/api-stack.ts`](../../infra/lib/stacks/api-stack.ts) had been duplicated (two `ApiStack` classes, `Duplicate identifier`). That was an edit mistake when comments were added, not a missing AWS permission. The file is a single class again. Retry with `AWS_PROFILE=dwt-dev` and `CDK_DEFAULT_*` set. Do not paste deploy logs that contain ARNs into chat if you can avoid it.

**Code:** `infra/lib/stacks/api-stack.ts`, `learn/steps/07-api-proving-path/README.md`

---

## 2026-09-21 — DwtApi deploy asked y then rolled back

**Step:** 07

**Q:** Still failed but differently. I got asked whether to include some updates and said y. Then got lots of errors and it rolled back.

**A:** **`y` was correct** — that prompt is CDK `--require-approval broadening` for new Lambda IAM (DynamoDB + CloudWatch). The rollback was API Gateway: REST cannot have `{movementId}` and `{wasteTrackingId}` as siblings under `/movements`. The Gateway path is now `movements/{movementId}/receive`; the handler still treats the value as a Phase 1 id. Wait for `ROLLBACK_COMPLETE` (or a deleted stack), then `npx cdk deploy DwtApi` again.

**Code:** `infra/lib/stacks/api-stack.ts`, `src/lib/operations/receipts.ts`

---

## 2026-09-21 — What is lesson 07 step 3 (collect outputs) for?

**Step:** 07

**Q:** In step 3 of the manual steps — collect outputs: you need to explain what this is trying to achieve.

**A:** It copies CloudFormation **outputs** into this shell so the proving `curl` has a URL and credentials. `API_BASE` is `DwtApi` `ApiBaseUrl` (`…/dwt`). `SECRET_ARN` points at Secrets Manager; `API_KEY` is the `x-api-key` value (not the Cognito client secret). `TOKEN_URL` is `DwtAuth` so you can mint a JWT again. Nothing new is created. Same terminal as deploy. Do not paste `API_KEY` into chat.

**Code:** `learn/steps/07-api-proving-path/README.md`, `infra/lib/stacks/api-stack.ts`

---

## 2026-09-21 — Should collect outputs print anything?

**Step:** 07

**Q:** Am I expecting any output on the terminal?

**A:** The four `VAR=$(aws …)` lines print **nothing** on success — `$()` swallows stdout into the variable. That is working. The following `echo "API_BASE set: …"` should print `yes`. `echo "$API_BASE"` should look like `https://….execute-api.eu-west-2.amazonaws.com/prod/dwt`. Red error text means the stack name, profile, or region is wrong. Do not paste `API_KEY` into chat.

**Code:** `learn/steps/07-api-proving-path/README.md`

---

## 2026-09-21 — Repeat get TOKEN in lesson 07 instead of pointing at 05

**Step:** 07

**Q:** In step 4 you say get TOKEN as in step 05. Can you repeat that here for ease rather than having to go and find the previous step?

**A:** Yes. Step 07 now inlines the Cognito client-credentials curl. `TOKEN_URL` comes from step 3; `CLIENT_ID` / secret from Cognito (or `describe-user-pool-client`). Pipe through `jq -r .access_token` so `TOKEN` is the JWT string for `Authorization: Bearer`, not the whole JSON envelope from lesson 05. Do not paste it into chat.

**Code:** `learn/steps/07-api-proving-path/README.md`

---

## 2026-09-21 — Step 5 POST /movements returned 401

**Step:** 07

**Q:** Step 5 returned 401.

**A:** 401 `Unauthorized` is the Cognito authorizer, not a missing API key (that is 403). M2M client credentials return an **access** token. API Gateway’s Cognito authorizer only accepts that token if the method lists `authorizationScopes: ['dwt/movements']`; without scopes it wants an **ID** token. That scope is now on each route — `npx cdk deploy DwtApi` again (`y` for IAM), then mint a fresh `TOKEN` and retry the curl. First check `echo "${TOKEN:0:3}"` is `eyJ`, not `nul`. Do not paste the token into chat.

**Code:** `infra/lib/stacks/api-stack.ts`, `learn/steps/07-api-proving-path/README.md`

---

## 2026-09-21 — How do I make step 6 (auth failures) fail?

**Step:** 07

**Q:** In step 6. Can you explain how I make it fail.

**A:** Reuse step 5’s URL and variables, but **leave something out**. (1) Drop the `Authorization` header → 401. (2) Drop `x-api-key` → 403. (3) Keep both headers and `--data '{}'` → 400 with `validation.errors` / `NotProvided`. Do not paste tokens or API keys into chat.

**Code:** `learn/steps/07-api-proving-path/README.md`

---

## 2026-09-21 — Bruno and Postman learning files for step 07

**Step:** 07

**Q:** In step 8 you talk about optional GUI. Can you create links to separate learning files that show how to do this using Bruno and Postman. Show necessary installation steps then how to use.

**A:** Yes. Install-and-use guides: [`learn/bruno.md`](../bruno.md) and [`learn/postman.md`](../postman.md). Step 07.8 and [`learn/tools.md`](../tools.md) link them. Each covers install (`brew install --cask` or the vendor download), an environment (`apiBase`, `tokenUrl`, client + API key), Get token, POST `/movements`, then the 401/403/400 variants. Secrets stay in the GUI environment — not git, not chat.

**Code:** `learn/bruno.md`, `learn/postman.md`, `learn/steps/07-api-proving-path/README.md`

---

## 2026-09-22 — Did we abandon Firehose Parquet for bronze JSON?

**Step:** 08

**Q:** Looking at step 08. I thought we had abandoned the conversion to Parquet so we stored the raw JSON in S3 as bronze layer and would use Parquet in silver layer?

**A:** That *was* true of the first lake design (Firehose converted to Parquet on write, `payload` as a string). The stack now matches the bronze/silver split: Firehose writes JSONL to `bronze/events/`; an on-demand Glue job writes Parquet to `silver/events/` and registers `dwt_lake.silver_waste_movement_events`. See the later Q&A on why the string-in-Parquet approach was dropped.

**Code:** `infra/lib/constructs/movement-lake.ts`, `infra/lib/stacks/events-stack.ts`, `learn/architecture.md`, `learn/steps/08-events-lake/README.md`

---

## 2026-09-22 — Does Parquet with a JSON string payload make sense?

**Step:** 08

**Q:** Okay - does the parquet file with json string inside it make sense? Not sure why we'd do this.

**A:** It did not — that was only a Firehose/Glue workaround. The lake is now bronze JSON (nested `payload` object) plus a later Glue job that writes silver Parquet of the same shape. `streamEnrichment` no longer stringifies `payload`.

**Code:** `src/lambdas/streamEnrichment/index.ts`, `infra/lib/constructs/movement-lake.ts`

---

## 2026-09-22 — Implement bronze JSON and silver Parquet

**Step:** 08

**Q:** Okay - let's go for the bronze/silver split to make it a cleaner version. Bring raw JSON over into S3 as bronze then use parquet to convert to silver layer.

**A:** Done. Firehose writes uncompressed JSONL to `bronze/events/` (no format conversion). `streamEnrichment` keeps `payload` as an object. On-demand Glue job `dwt-bronze-to-silver` (`infra/glue/bronze_to_silver.py`) overwrites `silver/events/` as Parquet and updates `dwt_lake.silver_waste_movement_events`. Failed Firehose deliveries go to `bronze/errors/`. The automated check only requires the stack; bronze wait + Glue run are manual.

**Code:** `infra/lib/constructs/movement-lake.ts`, `infra/glue/bronze_to_silver.py`, `learn/steps/08-events-lake/README.md`

---

## 2026-09-22 — Inline POST /movements in lesson 08 step 3

**Step:** 08

**Q:** In step 3 of lesson 08 can you include instructions for adding post events rather than say see step 07.

**A:** Yes. Step 08.3 now collects `API_BASE` / `API_KEY` / `TOKEN_URL` / Cognito client, mints a JWT, and POSTs [`learn/fixtures/create-movement.json`](../fixtures/create-movement.json). Then wait 2 minutes for Firehose. A movement from before `DwtEvents` deployed will not land in bronze (Pipe `LATEST`). Do not paste tokens or API keys into chat.

**Code:** `learn/steps/08-events-lake/README.md`

---

## 2026-09-22 — npx cdk deploy DwtEvents failed

**Step:** 08

**Q:** `npx cdk deploy DwtEvents` didn't work.

**A:** The IAM prompt (`y`) was correct. CloudFormation failed creating the Kinesis stream: *The AWS Access Key Id needs a subscription for the service (Service: Kinesis)*. That is **OptInRequired**, not a CDK bug and not a missing IAM action. Open [Kinesis Data streams (eu-west-2)](https://eu-west-2.console.aws.amazon.com/kinesis/home?region=eu-west-2#/streams/list) and accept Get started / subscribe (root if the console asks). The stack is `ROLLBACK_COMPLETE`, so you can deploy again after the service is on. Do not paste account ids into chat.

**Code:** `learn/steps/08-events-lake/README.md`, `infra/lib/stacks/events-stack.ts`

---

## 2026-09-22 — Do I need a paid Kinesis subscription on Free Tier?

**Step:** 08

**Q:** Is this because I have a free account plan? Do I need a paid subscription for Kinesis?

**A:** There is no Kinesis product to buy. You pay [on-demand](https://aws.amazon.com/kinesis/data-streams/pricing/) for one shard. On the **new** AWS **Free plan**, Kinesis is only unlocked after you upgrade the *account* to the **Paid** plan (pay-as-you-go). That is not a Kinesis subscription. See the next Q&A for the Complete registration screens.

**Code:** `learn/steps/08-events-lake/README.md`

---

## 2026-09-22 — Kinesis link opens Complete registration

**Step:** 08

**Q:** What I click on the kinesis link you provided it takes me to complete registration. I go into this and it's not obvious what I need to do.

**A:** That page is the **AWS account**, not a Kinesis setting. Sign in as [root](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_root-user.html) (signup email). If you see **Upgrade** / Free vs Paid: [Settings → Billing → Upgrade](https://settings.aws.com) → **Get started** → payment method → **Upgrade account**. [Kinesis is on the Paid plan](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html) of the new signup. If you see **sign-up is almost complete**: add a card (possible ~$1 hold), SMS-verify the phone, pick **Basic** support, **Complete sign up**, wait for the activation email. Do not paste card numbers or OTPs into chat. Then reopen the [Kinesis stream list](https://eu-west-2.console.aws.amazon.com/kinesis/home?region=eu-west-2#/streams/list) and redeploy `DwtEvents`.

**Code:** `learn/steps/08-events-lake/README.md`

---

## 2026-09-22 — What do I do in lesson 08 steps 4, 5 and 6?

**Step:** 08

**Q:** not sure what I'm doing for steps 4,5 and 6

**A:** Look only — do not create a bus, stream, or bucket. (4) EventBridge custom bus `dwt-waste-movements` → **Rules** — one rule targeting Kinesis (`aws events list-rules`). (5) Kinesis stream `dwt-waste-movements` **Active**, 1 shard — you will not see movement JSON there. (6) S3 lake bucket from output `LakeBucketName` → `bronze/events/` — after the step 3 POST and ~2 minutes, list/download a file; `payload` must be a JSON object. Empty bronze: wait, or POST again after the stack was `CREATE_COMPLETE`.

**Code:** `learn/steps/08-events-lake/README.md`

---

## 2026-09-22 — Do I run the Glue job from the CLI or the console?

**Step:** 08

**Q:** In step 7 you say run it once after bronze exists. Do I run this from the command prompt using the commands you supplied or does this just create the job and I then need to go to console to run it?

**A:** The terminal. `cdk deploy` already created the job. `aws glue start-job-run --job-name "$JOB"` **starts** that job. A `JobRunId` in the response means it is running. The Glue console is optional (watch until Succeeded). Do not Create job. Only start it after `bronze/events/` has an object.

**Code:** `learn/steps/08-events-lake/README.md`

---

## 2026-09-22 — Sample Athena SQL for step 08

**Step:** 08

**Q:** In step 8 can you provide some sample SQL to run to see the data

**A:** Yes. After the Glue job succeeds, [Athena query editor](https://eu-west-2.console.aws.amazon.com/athena/home?region=eu-west-2#/query-editor), database `dwt_lake`. Set the result location to `s3://$BUCKET/athena-results/` if asked. Start with `SHOW TABLES` / `DESCRIBE dwt_lake.silver_waste_movement_events`, then `SELECT "eventType", "publicId", "apiCode" … LIMIT 20`, then a nested `payload.producer.organisationName` filter on `MOVEMENT_CREATED`. Quote camelCase columns if Athena cannot resolve them. Do not paste result rows into chat.

**Code:** `learn/steps/08-events-lake/README.md`

---

## 2026-09-22 — Athena first-visit instructions in step 8

**Step:** 08

**Q:** Don't understand the first visit instructions in step 8

**A:** Athena needs a folder for *its* output CSVs, not for bronze/silver. In the same terminal: `aws s3api put-object --bucket "$BUCKET" --key athena-results/` then copy `s3://$BUCKET/athena-results/`. Open the [query editor](https://eu-west-2.console.aws.amazon.com/athena/home?region=eu-west-2#/query-editor) (eu-west-2, workgroup **primary**) → banner or **Settings → Manage** → paste that path → Save. Left: catalog `AwsDataCatalog`, database `dwt_lake`. Then paste SQL and **Run**. You are not creating a Glue table.

**Code:** `learn/steps/08-events-lake/README.md`

---

## 2026-09-22 — Commit instructions at the end of each lesson

**Step:** cross-cutting

**Q:** Can you add instructions at end of each lesson that shows how to commit any changes to github

**A:** Yes. Every step README now ends with **Save your work (GitHub)**: `git status`, `git add -A`, review, `git commit`, `git push` from the repo root. Shared notes: [`learn/commit.md`](../commit.md). Push needs `origin` from step 04b — skip it before then. Do not commit `.env`, keys, or tokens. `nothing to commit` is fine if you only read.

**Code:** `learn/commit.md`, `learn/steps/*/README.md`

---

## 2026-09-22 — Explain DwtCharging and self-explanatory comments

**Step:** 09

**Q:** Need to explain what is happening in DwtCharging and make sure the comments within it make how it works self-explanatory.

**A:** `DwtCharging` is the Billing subscriber on the same bus as the lake: chargeable lifecycle types only → SQS → Lambda → operator ledger (`OPERATOR#` / `PAYMENT#`). The API never calls it; a down worker still leaves `201`. DLQ after five failures + alarm is the pager. Per-event amount is a placeholder. The £26 annual fee is the **same** ledger (different SK, onboarding then yearly) — not implemented here. Comments in [`charging-stack.ts`](../../infra/lib/stacks/charging-stack.ts) and the charging Lambda are the walkthrough.

**Code:** `infra/lib/stacks/charging-stack.ts`, `src/lambdas/charging/index.ts`, `learn/steps/09-charging/README.md`

---

## 2026-09-22 — Does the £26 fee share the charging schema?

**Step:** 09

**Q:** You say this is not the £26 annual subscription, that is a different Billing workflow. It would end up in the same charging schema though wouldn't it? We will need to consider waste operator onboarding at a later time. The £26 fee is incurred initially here then due annually after that.

**A:** Yes — same Billing context and the same operator ledger (`PK=OPERATOR#`). It is a different *line* (`SK` like `SUBSCRIPTION#<year>`, not `PAYMENT#<eventId>`) and a different *trigger* (operator onboarded, then anniversary), not a second table. GOV.UK Pay and onboarding stay later; when they arrive they should `PutItem` this table. This slice still only writes per-event placeholder units.

**Code:** `infra/lib/stacks/charging-stack.ts`, `src/lambdas/charging/index.ts`, `learn/steps/09-charging/README.md`

---

## 2026-09-22 — Step 09.4 queues have no messages

**Step:** 09

**Q:** For step 4 - what should I see? I've looked at the queues and there aren't any messages there.

**A:** An empty queue is the happy path. The charging Lambda receives and deletes the SQS message in about a second, so **Send and receive messages** stays empty. Look at queue **Monitoring** (messages sent / deleted) and step 5 — a `PAYMENT#` row on the operator ledger. Available messages = 0 and a ledger row means it worked. Empty ledger as well: POST again after the stack was `CREATE_COMPLETE`.

**Code:** `learn/steps/09-charging/README.md`

---

## 2026-09-22 — What do I do in lesson 09 step 5?

**Step:** 09

**Q:** Not sure what I'm doing in step 5

**A:** Read the operator ledger — do not create a table. `echo` output `OperatorLedgerTableName` (hashed `DwtCharging-OperatorLedger…`). [DynamoDB tables](https://eu-west-2.console.aws.amazon.com/dynamodbv2/home?region=eu-west-2#tables) → that name → **Explore table items** → **Run**. Expect `PK=OPERATOR#…`, `SK=PAYMENT#…`, `eventType=MOVEMENT_CREATED`, `amount=1`, `publicId` = the 201 `movementId`. Same via `aws dynamodb scan` with the `--query` in the README. This is not the movements table.

**Code:** `learn/steps/09-charging/README.md`

---

## 2026-09-22 — Lesson 10 journey in Bruno and curl

**Step:** 10

**Q:** For lesson 10 can this show detailed steps for walking the journey with Bruno (and also give the equivalent curl commands).

**A:** Yes. Step 10 now walks create → STATIC collection → delivery → receipt → fate → EWC with Bruno and curl for each call. New fixtures: `record-collection.json`, `record-delivery.json`, `record-receipt.json`. Bruno stores `movementId` / `deliveryId` via `bru.setEnvVar`. Curl uses `jq` to capture ids and inject `movementIds`. Fate should end `RECEIVED`. Do not paste tokens into chat.

**Code:** `learn/steps/10-remaining-and-prod/README.md`, `learn/fixtures/record-collection.json`

---

## 2026-09-22 — Lesson 10 Bruno setup then curl alternative

**Step:** 10

**Q:** In the manual steps you will need to give instructions for doing this all in Bruno (and then give the alternative approach using curl). It will need to explain how to setup Bruno initially to do these steps as well as instructions for using Bruno.

**A:** Step 10 is Bruno-first. Manual steps 0–0d cover install (`brew install --cask bruno` or [downloads](https://www.usebruno.com/downloads)), collection `dwt-sandbox`, environment `dev`, CloudFormation → env vars (`apiBase`, `tokenUrl`, `clientId`, `clientSecret`, `apiKey`, plus empty `token` / `movementId` / `deliveryId`), and how headers + `bru.setEnvVar` work. Steps 1–7 are click-by-click Bruno requests. **Alternative: curl** is the same journey in the terminal. Shared setup notes stay in [`learn/bruno.md`](../bruno.md). Do not paste tokens or API keys into chat.

**Code:** `learn/steps/10-remaining-and-prod/README.md`, `learn/bruno.md`

---

## 2026-09-22 — Which values go into Bruno vars?

**Step:** 10

**Q:** When you say "Copy CloudFormation / Secrets Manager values into Bruno vars — not into chat" which ones are these? The client or the AWS Key?

**A:** Both **vendor** secrets, not your AWS IAM access key. Bruno `dev` needs `clientId` + `clientSecret` (Cognito app client — used by **Get token**) **and** `apiKey` (Secrets Manager value behind `DwtApi` `ApiKeySecretArn` — the `x-api-key` header). Also paste the URLs `apiBase` and `tokenUrl`. Leave `token` / `movementId` / `deliveryId` empty. Do **not** put `aws configure` access keys into Bruno or into chat.

**Code:** `learn/steps/10-remaining-and-prod/README.md` (section 0c)

---

## 2026-09-22 — How to record vendor client id/secret in Bruno

**Step:** 10

**Q:** I'm still uncertain. This is the vendor client id and secret? How do I record them in Bruno?

**A:** Yes — Cognito **app client** id and secret from `DwtAuth` (the vendor M2M client), not IAM keys. Record them as environment variables: top-right picker → **Configure** → `dev` → add rows `clientId` and `clientSecret` (Name / Value) → Save → keep **dev** selected. Do not paste them into the Get token body; that request uses `{{clientId}}` / `{{clientSecret}}` as Basic auth. Also add `apiBase`, `tokenUrl`, `apiKey` the same way. Do not paste the values into chat.

**Code:** `learn/steps/10-remaining-and-prod/README.md` (section 0c)

---

## 2026-09-22 — Step 0c export prints nothing

**Step:** 10

**Q:** When I run the export in step 0c it doesn't return anything.

**A:** Expected. `export AWS_PROFILE=dwt-dev` (and `export AWS_DEFAULT_REGION=eu-west-2`) only set this terminal — they never print. The values come from the following `aws cloudformation describe-stacks` lines, each of which should print one URL/ARN/id. `POOL=$(…)` / `CLIENT_ID=$(…)` are also silent; only `describe-user-pool-client` prints the Cognito secret. If those `aws` commands are blank or error, check region **eu-west-2** and that `DwtApi` / `DwtAuth` exist. `describe-stacks --stack-name DwtApi --query Stacks[0].StackStatus` should print `CREATE_COMPLETE` or `UPDATE_COMPLETE`. Do not paste secrets or `sts` JSON into chat.

**Code:** `learn/steps/10-remaining-and-prod/README.md` (section 0c)

---

## 2026-09-22 — How do I print each next value in the terminal?

**Step:** 10

**Q:** How do I "Print each next value in your terminal"

**A:** Run each `aws cloudformation describe-stacks … --output text` command in the same terminal where you exported the profile. The one line AWS writes back *is* the value — there is no extra `print` or `echo`. Copy that line into the matching Bruno `dev` var (`apiBase`, then the Secrets Manager ARN → `apiKey`, then `tokenUrl`, then `clientId`). Do not paste those lines into chat.

**Code:** `learn/steps/10-remaining-and-prod/README.md` (section 0c)

---

## 2026-09-22 — Commands for tokenUrl and the other Bruno vars

**Step:** 10

**Q:** Can you give the commands for tokenUrl, etc.

**A:** Same terminal as `export AWS_PROFILE=dwt-dev` and `export AWS_DEFAULT_REGION=eu-west-2`. `tokenUrl`: `describe-stacks DwtAuth` query `TokenUrl`. `clientId`: same stack, query `ClientId`. `clientSecret`: `describe-user-pool-client` after capturing `UserPoolId` and `ClientId`. `apiBase`: `DwtApi` query `ApiBaseUrl`. `apiKey`: `DwtApi` query `ApiKeySecretArn`, then `secretsmanager get-secret-value`. Copy each one-line result into Bruno `dev`. Do not paste the outputs into chat.

**Code:** `learn/steps/10-remaining-and-prod/README.md` (section 0c)

---

## 2026-09-22 — What does Get token do?

**Step:** 10

**Q:** I don't understand what 1. Get Token is doing.

**A:** It is a login for **vendor software**, not a waste-API call. Bruno POSTs to Cognito `{{tokenUrl}}` (`/oauth2/token`) with HTTP Basic (`{{clientId}}` / `{{clientSecret}}`) and form fields `grant_type=client_credentials` and `scope=dwt/movements`. Cognito returns a JWT in `access_token`. The Tests script stores it as Bruno `token`. Later requests send `Authorization: Bearer {{token}}` to API Gateway. Same as lesson 05. It does not create a movement.

**Code:** `learn/steps/10-remaining-and-prod/README.md` (step 1), `learn/steps/05-auth-stack/README.md`

---

## 2026-09-22 — What am I doing in lesson 10 step 5?

**Step:** 10

**Q:** What am i doing in step 5?

**A:** Recording a **receipt**: the receiving site accepts the waste that step 4 delivered. Bruno POSTs [`learn/fixtures/record-receipt.json`](../fixtures/record-receipt.json) to `{{apiBase}}/deliveries/{{deliveryId}}/receipt` with the same JWT + API key. Expect **201**. That writes `WASTE_RECEIVED` and makes fate **RECEIVED**. `receiverSite` must include site name, permit, address, and email or phone. This is not Get token and not lesson 09’s operator-ledger look-up.

**Code:** `learn/steps/10-remaining-and-prod/README.md` (step 5), `src/lib/operations/receipts.ts`

---

## 2026-09-22 — What does bru.setEnvVar on Get token do?

**Step:** 10

**Q:** Sorry - step 5 of 1. Get Token where I run bru.setEnvVar("token", res.body.access_token);

**A:** You do not run that in a terminal. Paste it once into the Get token request’s **Tests** tab. After **Send**, Bruno executes it: `res.body.access_token` is Cognito’s JWT; `bru.setEnvVar("token", …)` stores it in the `dev` environment variable `token` so later calls can send `Bearer {{token}}`. Confirm `token` is filled in the environment picker. Do not paste the JWT into chat.

**Code:** `learn/steps/10-remaining-and-prod/README.md` (Get token, Tests)

---

## 2026-09-22 — STATIC collection did not work

**Step:** 10

**Q:** 3. Record STATIC collection didn't work

**A:** A **201** with `{ "validation": { "warnings": [] } }` is success — collection does not return a new id. Usual failures: body still the create fixture (**400**); copied Tests `bru.setEnvVar("movementId", res.body.movementId)` wiped `dev.movementId` (**404** on retry); expired token (**401**); already collected so the next event must be TRANSIT. Replace the body with `learn/fixtures/record-collection.json`, delete that Tests line, confirm `movementId` is a `26…` sqid, then Send. Do not paste tokens into chat.

**Code:** `learn/steps/10-remaining-and-prod/README.md` (step 3), `learn/fixtures/record-collection.json`

---

## 2026-09-22 — Create movement wipes Bruno movementId

**Step:** 10

**Q:** Looks like movementId is getting wiped in Environment when Create Movement is run

**A:** The Create movement **Tests** script was writing `undefined` into `dev.movementId`. That happens when `res.body` is a string (Bruno has not parsed JSON) or the send was not a 201, and `bru.setEnvVar` persists the empty value. Replace the Tests tab with a guarded script: parse `res.getBody()` / `res.body`, then `setEnvVar` only if `parsed.movementId` is set. Keep Get token’s `access_token` script off this request. If the 201 JSON shows a `26…` id, you can paste that into `dev` by hand.

**Code:** `learn/steps/10-remaining-and-prod/README.md` (Create movement Tests)

---

## 2026-09-22 — Delete token line vs apiCode in collection JSON

**Step:** 10

**Q:** When you say "Delete any access_token / token line on this request (that belongs on Get token only)." what do you mean? Delete the apiCode line in the json from the record collection action?

**A:** No. Leave `apiCode` in [`record-collection.json`](../fixtures/record-collection.json). “Token line” means a **Tests** tab JavaScript snippet such as `bru.setEnvVar("token", …)` or anything mentioning `access_token`, copied from Get token onto Create movement. That is not the request Body. Collection’s Body should be the full fixture, including `apiCode`.

**Code:** `learn/steps/10-remaining-and-prod/README.md` (Create movement Tests vs Record collection Body)

---

## 2026-09-22 — Next collection event must be TRANSIT

**Step:** 10

**Q:** Still fails but differently. Here's the message: validation.errors collectionType BusinessRuleViolation "Next collection event must be TRANSIT"

**A:** STATIC already exists on that movement. Collection is a sequence: first event STATIC, any later event TRANSIT (handover). A second POST of `record-collection.json` (`collectionType: STATIC`) is rejected. Skip step 3 and go to **Record delivery** with the same `movementId`. Only run Create movement again if you want a fresh STATIC practise. Do not paste ids into chat.

**Code:** `learn/steps/10-remaining-and-prod/README.md` (step 3), `src/lib/rules.ts` (`nextCollectionType`)

---

## 2026-09-22 — 401 Unauthorized on a later journey call

**Step:** 10

**Q:** Getting 401 { "message": "Unauthorized" }

**A:** API Gateway’s Cognito authorizer rejected the JWT. Not a missing `x-api-key` (that is 403). Re-run **Get token**, confirm `dev` is selected and `token` starts `eyJ`, header `Authorization: Bearer {{token}}`, then retry the same request (delivery/receipt/fate). Do not create a new movement. Do not paste the token into chat.

**Code:** `learn/steps/10-remaining-and-prod/README.md` (step 4), `learn/steps/07-api-proving-path/README.md`
