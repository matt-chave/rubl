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

**A:** The *contract* is [`openapi/openapi.yaml`](../../openapi/openapi.yaml) (e.g. `createMovementRequest`). Runtime checks are hand-written TypeScript under [`src/lib/validation/`](../../src/lib/validation/), not AJV compiled from the YAML — the spec $refs an external producer schema we do not vendor. `validateOperation` is the single entry point. The EventBridge envelope field `payload` is that same accepted body stored as JSON (stringified for Parquet).

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

**A:** At the **repo root**, not under `infra/` or `learn/`. Full path: `report-waste-movements/cdk.out/DwtLedger.template.json`. CDK writes all synthesised CloudFormation there when you run `npx cdk synth` or `npm run learn -- 02`. The folder is in `.gitignore` because it is generated; Cursor may hide it from source control. Open it from the file explorer or `open cdk.out/DwtLedger.template.json`. Sibling files: `DwtAuth`, `DwtEvents`, `DwtCharging`, `DwtApi`.

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

**A:** There is no git repository yet. The project exists only as a folder on this machine: `~/projects/report-waste-movements`. Follow [step 04b](../steps/04b-share-the-repo/README.md): `git init`, first commit (`.gitignore` already excludes `node_modules` and `.env`), empty GitHub repo, `git remote add origin`, `git push`. Do not commit AWS keys or `cdk.out`.

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
