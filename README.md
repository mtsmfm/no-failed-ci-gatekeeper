# no-failed-ci-gatekeeper

A GitHub Action that stands in for the required checks missing when conditional workflows are skipped.

## Motivation

GitHub's branch protection rules expect every Required status check to appear on every PR.
But conditional workflows (`paths:`, `paths-ignore:`, `[skip ci]`, etc.) skip jobs entirely, leaving no check to pass and blocking merges.
However, having no Required status check could result in an accidental merge even though the CI has failed.
You can set the status created by this action as Required status check.

## How it works

This action creates a single commit status on every PR head commit.

- **If at least one workflow executes** -> it waits for all running workflows and reports the aggregate result (`success` when they all pass, otherwise `failure`).
- **If no workflow executes at all** -> once a PR gets review it creates `success` result.

## Quick start

```yaml
TODO
```

1. Add the workflow above.
2. Create PR and run the above workflow at least once
3. Open **Settings > Rulesets > YOUR RULE > Require status checks to pass** and add **no-failed-ci-gatekeeper** _only_.

---

## Inputs

| Name           | Required | Default                   | Description                                       |
| -------------- | -------- | ------------------------- | ------------------------------------------------- |
| `github-token` |          | `${{ github.token }}`     | The GitHub token to use for authentication.       |
| `context`      |          | `no-failed-ci-gatekeeper` | The context (label) to use for the commit status. |
