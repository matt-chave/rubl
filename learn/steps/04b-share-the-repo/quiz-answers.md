# Step 04b answers

1. Git stores snapshots (commits) on your laptop. GitHub is a server copy that other people can clone or be invited to.
2. Anyone who can clone the repo would get those secrets. `.gitignore` keeps them off the snapshot, and you should still check `git status` before you commit.
3. `origin` is the default name for “the server copy of this repo.” `git push` and `git pull` talk to `origin` unless you say otherwise.
4. GitHub’s README or license is a second first commit, so `git push` fails with `rejected` / `fetch first`. Leave README off, gitignore as None, and license as No license. `git ls-remote --heads origin` must print nothing.
5. A clone includes history and the `origin` link, so they can pull your later commits. A zip is a one-off copy of today’s files with no history.
