# Save a lesson to GitHub

Each step README ends with the same checkpoint. Run it from the **repo root** (`rubl/`), not from `learn/steps/…`.

```
git   = snapshot on this laptop (commit)
GitHub = server copy (push to origin)
```

You do not need a new GitHub repo each lesson. Step 04b created `origin` once.

## Commands

```bash
git status
git add -A
git status
git commit -m "learn: complete step NN — short title"
git push
```

1. First `git status` — see what changed (README notes, `progress.json`, code).
2. `git add -A` — stage those files.
3. Second `git status` — confirm nothing secret is listed.
4. `git commit` — writes the snapshot. If it says **nothing to commit**, you only read; that is fine.
5. `git push` — updates GitHub. Needs `origin` from [step 04b](steps/04b-share-the-repo/README.md).

## Before step 04b

`git commit` is enough. `git push` will fail until `origin` exists — skip it.

## Do not commit

[`.gitignore`](../.gitignore) should already hide these. If `git status` still shows them, **unstage** (`git restore --staged FILE`) and do not add them:

- `.env`, access keys, Cognito client secrets, API keys, JWTs
- `cdk.out/`, `node_modules/`
- Anything you would not paste into chat

Do not paste `git status` output that contains secrets into chat.

## If `git push` is rejected

Someone else pushed, or GitHub has commits you do not have:

```bash
git pull --rebase origin main
git push
```

Do not `--force` unless you are still in the empty-repo stub case in step 04b.
