# Step 04b answers

1. Git stores snapshots (commits) locally. GitHub is a server copy other people can clone or be invited to.
2. Anyone who can clone the repo would get those secrets. `.gitignore` keeps them off the snapshot; still check `git status` before you commit.
3. The default name for “the server copy of this repo.” `git push` and `git pull` talk to `origin` unless you say otherwise.
4. GitHub’s README **or license** is a second first commit. `git push` then fails with `rejected` / `fetch first`. Leave README off, gitignore None, license No license. `git ls-remote --heads origin` must print nothing.
5. Clone includes history and the `origin` link, so they can pull your later commits. A zip is a one-off copy of today’s files with no history.
