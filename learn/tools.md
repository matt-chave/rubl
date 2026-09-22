# Tools

Install only what the current step asks for. You do not need everything on day one.

## Required from step 01

| Tool | Why | Install |
|---|---|---|
| **Node.js 22+** | Runs tests, CDK, Lambdas (locally bundled) | [nodejs.org](https://nodejs.org/) or `nvm install 22` |
| **npm** | Comes with Node | `npm -v` |
| **A terminal** | All automated checks | macOS Terminal, iTerm, or Cursor’s terminal |
| **A text editor** | Read code and OpenAPI | Cursor |

```bash
node -v    # v22.x or newer
npm -v
```

## Required from step 02

| Tool | Why |
|---|---|
| **AWS CDK CLI** (via npx) | `npx cdk synth` / later `deploy` — already a project dependency |

## Required from step 04b (share the repo)

| Tool | Why | Install |
|---|---|---|
| **git** | Local history, then push to GitHub | [git-scm.com](https://git-scm.com/) — macOS: `git --version` (Xcode CLT if prompted). Each lesson ends with a checkpoint; notes in [commit.md](commit.md) |
| **A GitHub account** | Server copy others clone | [github.com](https://github.com/) |
| **GitHub CLI** (`gh`) | Optional: create + push in one command | [cli.github.com](https://cli.github.com/) |

## Required from step 04 if you chose AWS `dev`

| Tool | Why | Install |
|---|---|---|
| **AWS CLI v2** | Named profile, `sts get-caller-identity`, later stack outputs | [AWS CLI install](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) or `brew install awscli` |

Walkthrough (account vs IAM user vs `aws configure` vs `aws configure sso`): [aws-dev-setup.md](aws-dev-setup.md). **Never paste access keys into Cursor chat.**

## Required from step 05 (AWS)

| Tool | Why | Install |
|---|---|---|
| **AWS CLI v2** | Same as step 04 | Already installed if you followed [aws-dev-setup.md](aws-dev-setup.md) |
| **jq** | Parse JSON tokens and stack outputs | `brew install jq` |
| **curl** | Call the API (macOS has it) | `curl --version` |

```bash
export AWS_PROFILE=dwt-dev
aws sts get-caller-identity
```

## Strongly recommended for manual API work (step 07)

| Tool | Why |
|---|---|
| **[Bruno](bruno.md)** or **[Postman](postman.md)** | GUI to send Bearer + `x-api-key` + JSON body. Install + how-to in those files |
| **[AWS Management Console](https://eu-west-2.console.aws.amazon.com/console/home?region=eu-west-2)** (browser) | [Cognito](https://eu-west-2.console.aws.amazon.com/cognito/v2/idp/user-pools?region=eu-west-2), [DynamoDB](https://eu-west-2.console.aws.amazon.com/dynamodbv2/home?region=eu-west-2#tables), [SQS](https://eu-west-2.console.aws.amazon.com/sqs/v3/home?region=eu-west-2#/queues), [S3](https://s3.console.aws.amazon.com/s3/home?region=eu-west-2) after a write |

A saved Bruno/Postman request is the same as the `curl` in step 07 — pick **one**.

## Optional later

| Tool | Why |
|---|---|
| **Docker** | LocalStack mock (see [environments.md](environments.md)) |
| **Amazon Athena** (console) | Query silver Parquet after the step 08 Glue job |
| **CloudWatch Logs** | Read Lambda errors if a 500 appears |

## What the automated checks use

Steps 01–04: Node only.  
Step 04b: git (and a GitHub remote).  
Steps 05–09: AWS CLI via the SDK/`aws` in your shell environment (`AWS_PROFILE`). If `aws sts get-caller-identity` fails, those steps stop and tell you.
