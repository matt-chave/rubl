# Set up AWS `dev` (you do this — Cursor cannot)

Cursor and this tutorial **cannot** create your AWS account, IAM user, or access keys. Those live in *your* Amazon account. Do not paste access keys, passwords, or account numbers into chat.

A **named profile** is just a label saved on this laptop (for example `dwt-dev`). Later terminals run `export AWS_PROFILE=dwt-dev` so [CDK](https://docs.aws.amazon.com/cdk/v2/guide/home.html) talks to the sandbox and not some other AWS account already on your machine.

You need **one sandbox [AWS account](https://docs.aws.amazon.com/accounts/latest/reference/manage-acct-creating.html)** and **one human identity** that can administer it. You do **not** create [Amazon Cognito](https://docs.aws.amazon.com/cognito/latest/developerguide/what-is-amazon-cognito.html) “vendor users” here — step 05’s CDK stack does that.

Region for this project: **[eu-west-2](https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html)** (London). Console links below that include `eu-west-2` open that region after you sign in.

---

## Words that get mixed up

| Word | What it is |
|---|---|
| **[AWS account](https://docs.aws.amazon.com/accounts/latest/reference/accounts-welcome.html)** | A 12-digit billing container. Create **one sandbox** you are happy to destroy. Not your employer’s production account. |
| **[Root user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_root-user.html)** | The email you signed up with. Turn on [MFA](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa.html). Do **not** use [root access keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_root-user.html#id_root-user_manage_add-key) for the CLI. |
| **[IAM user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html)** | A person login *inside* that account, with its own keys. This is Path A below. |
| **[IAM Identity Center (SSO)](https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html)** | Work login: one portal, many accounts. This is Path B. You do not invent this — your org already has a start URL. |
| **[Named profile](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)** | An entry in `~/.aws/config` (and maybe `~/.aws/credentials`) called `dwt-dev`. The CLI uses it when `AWS_PROFILE=dwt-dev`. |
| **[`aws configure`](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html)** | Path A wizard: stores **access key + secret** for that profile. |
| **[`aws configure sso`](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html)** | Path B wizard: stores **SSO start URL + account + role**. You then [`aws sso login`](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html#cli-configure-sso-login). No long-lived access key on disk. |

Pick **one** path.

- Personal / learning laptop, no company AWS → **Path A**
- You already sign in at `something.awsapps.com/start` (or similar) → **Path B**

---

## Before either path

1. Install **[AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html) v2**: [install guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) or `brew install awscli`.
2. Check: `aws --version` — you want `aws-cli/2…`.
3. Optional but wise: open **[Billing and Cost Management → Budgets](https://console.aws.amazon.com/billing/home#/budgets)** and [create a budget](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-create.html) with an alert (for example £20). Sandbox stacks cost money once deployed. Billing is a **global** console (not eu-west-2).

---

## Path A — personal sandbox (IAM user + named profile)

Skip **Create the AWS account** and **Create the IAM user** if those already exist. Jump to [Already have an IAM user?](#already-have-an-iam-user) then to access keys / `aws configure` if the CLI is not set up yet.

### Already have an IAM user?

This is an **[IAM user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users.html)** inside the account (IAM → Users). It is not a Cognito vendor client, and it is not an SSO role (that is Path B).

You must be signed in as **root** or as a user who can change IAM. If you only have the user you are checking, and they cannot open IAM, sign in as root (or ask whoever owns the account).

#### Check permissions (Console)

1. Open **[IAM → Users](https://console.aws.amazon.com/iam/home#/users)** ([docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_manage.html)).
2. Click the user name.
3. Open the **Permissions** tab. Note three places rights can come from:
   - **Permissions policies** — attached directly ([attach / detach](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_manage-attach-detach.html))
   - **Groups** — click each group; the group’s policies apply to the user ([groups](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_groups.html))
   - **Permissions boundary** (uncommon) — a cap on what the user can ever do
4. For this tutorial’s sandbox, you want the AWS managed policy **[`AdministratorAccess`](https://docs.aws.amazon.com/aws-managed-policy/latest/reference/AdministratorAccess.html)** on the user or on a group they belong to. Anything narrower will fail later on `cdk deploy` in surprising ways.

#### Check permissions (CLI)

If a profile already works:

```bash
export AWS_PROFILE=dwt-dev   # or whatever profile this user uses
aws sts get-caller-identity
aws iam list-attached-user-policies --user-name YOUR_USER_NAME
aws iam list-groups-for-user --user-name YOUR_USER_NAME
```

[`list-attached-user-policies`](https://docs.aws.amazon.com/cli/latest/reference/iam/list-attached-user-policies.html) should include `AdministratorAccess` **or** a group from `list-groups-for-user` that has that policy (`aws iam list-attached-group-policies --group-name GROUP`).

Do not paste the JSON into chat.

#### Change permissions (Console)

1. Same user → **Permissions** → **Add permissions** → **Add permissions** ([guide](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_change-permissions.html)).
2. **Attach policies directly** → search `AdministratorAccess` → tick it → **Next** → **Add permissions**.
3. To take rights away: on the same tab, select a policy → **Remove**.

Do **not** attach `AdministratorAccess` on a shared production account. Sandbox only.

#### Change permissions (CLI)

```bash
aws iam attach-user-policy \
  --user-name YOUR_USER_NAME \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

[`attach-user-policy`](https://docs.aws.amazon.com/cli/latest/reference/iam/attach-user-policy.html). Detach with [`detach-user-policy`](https://docs.aws.amazon.com/cli/latest/reference/iam/detach-user-policy.html) and the same `--policy-arn`.

Then continue at [Create access keys](#3-create-access-keys-stay-on-this-machine) if this laptop has no profile yet, or [Prove it](#5-prove-it) if `dwt-dev` already exists.

**If you sign in through a work SSO portal**, do not use this IAM Users page. Permissions live on the **permission set** in [IAM Identity Center](https://eu-west-2.console.aws.amazon.com/singlesignon/home?region=eu-west-2#/instances) ([permission sets](https://docs.aws.amazon.com/singlesignon/latest/userguide/howtocreatepermissionset.html)). Ask your admin to attach `AdministratorAccess` (or a CDK-deploy set) to your user **on the sandbox account**. That is Path B.

### 1. Create the AWS account

1. Open [Create an AWS account](https://portal.aws.amazon.com/billing/signup) (or [aws.amazon.com](https://aws.amazon.com/) → Create an AWS account).
2. Use an email you control. Add a payment method (AWS bills unused resources).
3. Sign in as **root**. Enable **[MFA on the root user](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_root-user-console-sign-in.html#enable-mfa-for-root)**: [IAM → Dashboard](https://console.aws.amazon.com/iam/home#/home) → Security recommendations, or [My Security Credentials](https://console.aws.amazon.com/iam/home#/security_credentials).
4. Do not create [access keys for root](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_root-user.html#id_root-user_manage_add-key).

This account *is* `dev`. You do not need a second “DWT user account” from Amazon. Prod (step 10) would be a **different** 12-digit account later.

### 2. Create the IAM user *you* will use in the terminal

You are creating **one human deployer**, not vendor software users.

1. Open **[IAM → Users → Create user](https://console.aws.amazon.com/iam/home#/users$new)** ([docs](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_users_create.html)).
2. User name: `dwt-dev-admin` (any name you will recognise).
3. Check **Provide user access to the AWS Management Console** if you want a console password; you still need **access keys** for the CLI.
4. Permissions: **Attach policies directly** → [`AdministratorAccess`](https://docs.aws.amazon.com/aws-managed-policy/latest/reference/AdministratorAccess.html).  
   That is acceptable **only** because this is a throwaway sandbox. Do not do this in a shared production account.
5. Create the user.

### 3. Create access keys (stay on this machine)

The **secret** access key is shown **once**, at creation. AWS cannot display it again ([managing access keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html)). If you do not have it in a password manager or in `~/.aws/credentials` on this laptop, you need a **new** key pair. You do not need a new IAM user.

**Lost the secret?**

1. Look in your password manager, and on this Mac in `~/.aws/credentials` (a block under `[dwt-dev]` or `[default]` may already have `aws_secret_access_key`). Do not paste that file into chat.
2. If it is not there, create a new key (below). An IAM user may have **at most two** access keys. If both slots are full, [deactivate](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html#Using_UpdateAccessKey) then [delete](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html#Using_DeleteAccessKey) an unused key first (user → **Security credentials** → the old key → **Actions**).
3. After you create the new key, run `aws configure --profile dwt-dev` again so the laptop uses the new pair. The old key stops working once you delete it.

**Create a key**

1. Open that user in **[IAM → Users](https://console.aws.amazon.com/iam/home#/users)** → **Security credentials** → **Access keys** → **[Create access key](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html#Using_CreateAccessKey)**.
2. Use case: **Command Line Interface (CLI)**.
3. Copy both values into a **password manager** *before* you leave the page (see below).
4. Do not commit them. Do not paste them into Cursor.

**How to copy into a password manager**

A password manager is an app that stores secrets (Apple **Passwords**, [1Password](https://1password.com/), [Bitwarden](https://bitwarden.com/), etc.). It is not Notes, Slack, email, or this chat.

1. On the AWS “Retrieve access keys” page, use the **copy** icon next to **Access key ID**, then next to **Secret access key**. That puts each value on the clipboard.
2. Open your password manager → **New item** (often a Login, Secure Note, or API credential).
3. Suggested fields:
   - Title: `AWS dwt-dev IAM` (so you can find it later)
   - Username: the IAM user name (e.g. `dwt-dev-admin`)
   - Password: the **secret** access key
   - Notes: Access key ID (`AKIA…`), region `eu-west-2`, and that this is the CLI key
4. Save the item. Only then click **Done** on the AWS page.
5. Paste from the clipboard into `aws configure --profile dwt-dev` next. After that, you can clear the clipboard (copy something else).

`aws configure` **prints what you type** in the terminal window. Cursor keeps a transcript of that session. Treat that like a leaked secret: rotate the key (below) if it appeared on screen, and do not paste keys into chat.

On this Mac, **Passwords** is in Applications (or System Settings → Passwords) if you have not installed another manager. Do not screenshot the secret or leave it in a `.txt` on the Desktop.

### Rotate an access key (old one was typed in a terminal)

An IAM user can have **two** access keys. Create a **new** one, point `dwt-dev` at it, then delete the **old** one.

1. Open **[IAM → Users](https://console.aws.amazon.com/iam/home#/users)** ([manage access keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html)).
2. Click your deployer user → **Security credentials** → **Access keys**.
3. **[Create access key](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html#Using_CreateAccessKey)** → use case **CLI** → copy both values into the password manager *before* Done.
4. `aws configure --profile dwt-dev` and paste the **new** pair (region still `eu-west-2`). Prefer a **new** terminal tab afterwards so the old secret is not in that scrollback.
5. `export AWS_PROFILE=dwt-dev` then `aws sts get-caller-identity` (do not paste the JSON into chat).
6. Back on the same IAM page: on the **old** key → **Actions** → **Deactivate**, then **Delete**. The `AKIA…` you typed earlier should be the one you delete.

The Cognito **client secret** (`export CLIENT_SECRET=…`) is a different secret. It is not this IAM key. For this sandbox you can keep using it; do not paste it into chat either.


If you use work **SSO** (Path B), you do not need a secret access key. You use `aws sso login` instead.

### 4. Save them as profile `dwt-dev`

In a terminal ([named profiles](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)):

```bash
aws configure --profile dwt-dev
```

When prompted:

| Prompt | Type |
|---|---|
| AWS Access Key ID | the access key (looks like `AKIA…`) |
| AWS Secret Access Key | the secret |
| Default region name | `eu-west-2` |
| Default output format | `json` |

That writes `~/.aws/credentials` and `~/.aws/config`. Those files stay on **your** disk.

### 5. Prove it

```bash
export AWS_PROFILE=dwt-dev
aws sts get-caller-identity
```

[`get-caller-identity`](https://docs.aws.amazon.com/cli/latest/reference/sts/get-caller-identity.html) should print JSON with `Account` (12 digits), `Arn` (contains `dwt-dev-admin` or similar), and `UserId`.

**Do not** paste that JSON into git or chat. You are done with Path A.

---

## Path B — you already have AWS IAM Identity Center (SSO)

Someone in your org must give your [IAM Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html) user access to a **sandbox** account with enough rights to run CDK (typically `AdministratorAccess` or a custom “CDK deploy” [permission set](https://docs.aws.amazon.com/singlesignon/latest/userguide/permissionsetsconcept.html) on that account). Cursor cannot grant that.

```bash
aws configure sso --profile dwt-dev
```

CLI walkthrough: [Configure the AWS CLI to use IAM Identity Center](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html).

Typical prompts:

| Prompt | What to enter |
|---|---|
| SSO session name | `dwt` (any short name) |
| SSO start URL | the portal URL your org gave you (https://….awsapps.com/start) |
| SSO region | the region **of the SSO directory** (often `eu-west-2`; ask your admin if unsure) |
| Account | pick the **sandbox** account, not prod |
| Role | the permission set they assigned (often `AdministratorAccess` or `PowerUserAccess`) |
| CLI default client Region | `eu-west-2` |
| CLI default output format | `json` |
| Profile name | `dwt-dev` if it asks again |

Then, whenever the session expires:

```bash
export AWS_PROFILE=dwt-dev
aws sso login --profile dwt-dev
```

A browser window opens; you sign in with work credentials. Then:

```bash
aws sts get-caller-identity
```

Same check as Path A. Do not paste the output into chat.

---

## After Path A or B — mark this tutorial as `dev`

In [`learn/progress.json`](progress.json) set:

```json
"environment": "dev"
```

The step 04 automated check does **not** call AWS. Step 05 will fail until `aws sts get-caller-identity` works with `AWS_PROFILE=dwt-dev`.

Put this in your shell when you sit down to deploy (or add it to a local file that is **not** committed):

```bash
export AWS_PROFILE=dwt-dev
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export CDK_DEFAULT_REGION=eu-west-2
```

**[Bootstrap](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html)** (one-time per account/region) is **step 05**, not now:

```bash
npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/eu-west-2
```

---

## What you should *not* create in step 04

| Do not create now | Why |
|---|---|
| Extra AWS accounts named “Cognito” or “Lambda” | One sandbox account holds all five stacks |
| IAM users for waste carriers / producers | Vendors authenticate as [Cognito app clients](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-client-apps.html) after step 05 |
| IAM access keys for the AWS **root** user | Root is for billing and break-glass only |
| A “prod” account today | Step 10. Using prod here is how you wipe a legal lake with `cdk destroy` |

---

## If `get-caller-identity` fails

- `Unable to locate credentials` — you forgot `export AWS_PROFILE=dwt-dev`, or `aws configure --profile dwt-dev` was never run. See [credential errors](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-troubleshooting.html).
- SSO `Token has expired` — `aws sso login --profile dwt-dev`.
- Wrong account in the ARN — you selected the wrong SSO account; run `aws configure sso --profile dwt-dev` again and pick the sandbox.
- CLI v1 — upgrade to v2 ([install](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), then `aws --version`).
