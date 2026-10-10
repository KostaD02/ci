# Contributing

First of all, thanks for taking the time to contribute!

## How to start

```
git clone https://github.com/KostaD02/ci
cd ci
pnpm install
```

## Useful scripts

- `pnpm lint` - actionlint on the workflows and ESLint on the scripts
- `pnpm format` / `pnpm format:check` - format everything with Prettier
- `pnpm typecheck` - type-check the scripts
- `pnpm test` - unit tests for the action scripts

## File structure

- `.github/workflows` - the reusable workflows, plus `self-test.yml` and `preview-cleanup.yml`, which are this repository's own CI
- `.github/actions` - composite actions the workflows use
- `site` - the page the self-test deploys to [kostad02.github.io/ci](https://kostad02.github.io/ci/)
- `test` - unit tests

## Commits and pull requests

The project uses [conventional commits](https://www.conventionalcommits.org/), enforced by commitlint on every commit and on PR titles in CI.
PRs are squash merged, so the PR title becomes the commit on `main`.

Before pushing, make sure the following pass:

```
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

The pre-commit hook runs the same four. `self-test.yml` then runs every workflow and action on the PR.

## Keep in mind

- A reusable workflow runs with the caller's repository checked out, so everything it references in this repository uses the full path on the current major tag, for example `KostaD02/ci/.github/actions/setup@v1`. A change to an action has to be released before a workflow change that depends on it.
- The workflows declare no `permissions`; the caller grants what a job needs.
- Releases are manual, from the Release workflow: release-it bumps the version, writes the changelog, tags `vX.Y.Z`, and the major tag `vX` moves to it. Repositories pin `@v1`, so a merge reaches nobody until a release. To try a change first, point a job in another repository at the branch: `uses: KostaD02/ci/.github/workflows/lint.yml@ci/my-change`.
