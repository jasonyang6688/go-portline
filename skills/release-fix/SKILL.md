---
name: release-fix
description: Use when a verified go-termflow bug fix is ready to finish, ship, publish, commit, tag, or push.
---

# Release Fix

Publish every completed bug fix as the next patch release. The project grants standing authorization for the scoped commit, annotated tag, and push; do not ask again unless a guardrail stops the release.

## Workflow

1. Run fresh verification in the current working tree. Require `go test ./...`, `go build ./...`, `wails build`, and `git diff --check` for every fix release; `wails build` must succeed before staging or committing. Include UI browser QA when the project rules require it. Stop before staging, commit, tag, or push if any required command fails.
2. Fetch `origin` and tags. Stop if the current branch is behind/diverged, verification fails, or review finds an unresolved critical/high issue.
3. Inspect the full diff for secrets and unrelated work. Record the intended release paths and require the index to be empty before staging; stop if `git diff --cached --name-only` reports pre-existing staged files.
4. Stage the exact intended paths only; never use `git add -A`. Require `git diff --cached --name-only` to match the intended path list exactly, then run `git diff --cached --check` and review the complete staged diff.
5. Create one project-style `fix:` commit describing the behavioral result.
6. Find the highest stable `vMAJOR.MINOR.PATCH` tag and increment PATCH. Confirm the new tag does not exist locally or remotely.
7. Create an annotated tag with `git tag -a <tag> -m <tag>`. Before push, require `git rev-parse <tag>^{commit}` to equal `git rev-parse HEAD`.
8. Atomically push the current branch and tag to `origin`. Never force-push, move, delete, or reuse a tag.
9. Verify the remote branch commit and peeled annotated tag target match the released commit, then report the commit, tag, push, and test evidence.

## Guardrails

- Preserve unrelated dirty files exactly as found.
- Stop for tag conflicts, ambiguous version lines, remote divergence, secret exposure, failed checks, or authentication errors.
- Do not publish drafts, incomplete fixes, or changes the user explicitly says not to release.
- A documentation-only or feature change does not trigger this workflow unless the user asks to release it.
