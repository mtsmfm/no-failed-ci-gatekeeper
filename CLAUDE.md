# No Failed CI Gatekeeper - Project Notes

## Project Purpose

A GitHub Action that creates a required status check to prevent accidental merges when conditional workflows are skipped (due to `paths:`, `paths-ignore:`, `[skip ci]`, etc.).

## Implementation Approach

- **Event-driven design** to avoid wasteful polling
- Uses GitHub's native events to track workflow completion
- Creates commit status that can be set as required in branch protection

## Current Architecture

### Events Handled

1. **`check_suite: requested`** - Sets initial "pending" status when PR created/updated
2. **`check_suite: completed`** - Sets final status (success/failure) when all checks complete
3. **`pull_request_review: submitted`** - Handles approved PRs with no workflows (sets success)

### Key Design Decisions

- ✅ Removed `pull_request` event (redundant with `check_suite: requested`)
- ✅ Removed `workflow_run` event (redundant with `check_suite: completed`)
- ✅ Simplified to minimal event set for efficiency

## Build Commands

- `npm run build` - Build and bundle with esbuild (fast, clean output)
- `npm run lint` - ESLint
- `npm run typecheck` - TypeScript check

## Important Notes

- **Commit `dist/` directory** - Required for GitHub Actions to work
- Build produces single `dist/index.js` file only
- Using esbuild for fast bundling (much faster than ncc)

## Usage

Set "no-failed-ci-gatekeeper" as the only required status check in branch protection rules.
