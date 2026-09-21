# Step 04b — Put the project on GitHub so others can clone it

## What is happening

Until now the workshop has lived only on **this laptop**. Git is the history tool in the folder. GitHub is a **server copy** other people can clone and work on.

This is its own step, not part of 01. Step 01 proved Node and the tests. This step is a different skill: backup and collaboration. It sits after 04 because that step already talks about *one codebase, four environments* — the remote is what makes that codebase shareable. It sits before 05 so you have an off-laptop copy before you deploy.

```
This folder  --git push-->  GitHub  --git clone-->  someone else's laptop
```

- **git** — snapshots on your machine (`commit`)
- **GitHub** — the host others clone from (`origin`)
- **clone** — a full copy including history, not a zip of today’s files

## Why this is still local

Creating a GitHub repo does not need AWS. Do not commit `.env`, access keys, or `cdk.out/`. [`.gitignore`](../../../.gitignore) already lists those.

## Automated check

```bash
npm run learn -- 04b
```

Asserts this folder is a git repo, has at least one commit, `.gitignore` excludes `node_modules` and `.env`, those paths are not tracked, and a remote named `origin` exists. It does **not** push for you (that needs your GitHub login).

## Manual steps

1. `git --version` — install from [git-scm.com](https://git-scm.com/) if this fails.
2. At the repo root: `git init -b main`. You should see a `.git` folder (Cursor may hide it).
3. Open [`.gitignore`](../../../.gitignore). Confirm `node_modules`, `.env`, and `cdk.out` are listed.
4. First snapshot (only if `git status` shows no commits yet):

   ```bash
   git add .
   git status          # nothing secret? no .env, no keys
   git commit -m "Initial commit of the Digital Waste Tracking workshop."
   ```

5. On [github.com/new](https://github.com/new) create an **empty** repository (no README, no `.gitignore` — you already have those). Public if anyone may clone; private if you will add named collaborators. Copy the HTTPS or SSH URL.
6. Point this folder at that URL and publish:

   ```bash
   git remote add origin <the-url-from-github>
   git push -u origin main
   ```

   If you have the GitHub CLI: `gh repo create report-waste-movements --private --source=. --remote=origin --push` does steps 5–6 in one go.
7. In a **different** folder (or ask a colleague): `git clone <same-url>`. They should get the workshop and be able to run `npm install` and `npm run learn -- 01`.
8. Private repo: GitHub → **Settings → Collaborators** (or a team). The clone URL alone is not enough.

A Cursor-hosted copy is a private backup, not a public clone URL. Use GitHub when the goal is “other people work on this.”

## Quiz

[`quiz.md`](quiz.md)

## Next

Step 05 deploys **only** `DwtAuth` to AWS. If you have no account, stop after 04b — the GitHub copy is your backup of the local lab (01–04b).
