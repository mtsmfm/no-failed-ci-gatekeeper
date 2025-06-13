# no-failed-ci-gatekeeper

A GitHub Action that stands in for the required checks missing when conditional workflows are skipped.

## Motivation

GitHub's branch protection rules expect every Required status check to appear on every PR.
But conditional workflows (`paths:`, `paths-ignore:`, `[skip ci]`, etc.) skip jobs entirely, leaving no check to pass and blocking merges.
However, having no Required status check could result in an accidental merge even though the CI has failed.
You can set the status created by this action as Required status check.

## How it works

This action creates a single commit status on every PR head commit by responding to GitHub events:

- **On `check_suite` events** -> Sets initial "pending" status when requested, final status when completed
- **On `pull_request_review` events** -> If PR is approved and no workflows exist, sets "success" status

This event-driven approach avoids wasteful polling and responds immediately to workflow completions.

## Quick start

```yaml
name: CI Gatekeeper

on:
  check_suite:
    types: [requested, completed]
  pull_request_review:
    types: [submitted]

jobs:
  gatekeeper:
    runs-on: ubuntu-latest
    steps:
      - uses: mtsmfm/no-failed-ci-gatekeeper@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

1. Add the workflow above.
2. Create PR and run the above workflow at least once
3. Open **Settings > Rulesets > YOUR RULE > Require status checks to pass** and add **no-failed-ci-gatekeeper** _only_.

### Triggering workflows after all checks complete

You can create a separate workflow that runs after all checks pass by checking the status created by this action:

```yaml
name: Deploy After All Checks

on:
  status

jobs:
  deploy:
    if: |
      github.event.state == 'success' &&
      github.event.context == 'no-failed-ci-gatekeeper'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        run: echo "All checks passed, deploying..."
```

---

## Inputs

| Name           | Required | Default                   | Description                                       |
| -------------- | -------- | ------------------------- | ------------------------------------------------- |
| `github-token` |          | `${{ github.token }}`     | The GitHub token to use for authentication.       |
| `context`      |          | `no-failed-ci-gatekeeper` | The context (label) to use for the commit status. |
