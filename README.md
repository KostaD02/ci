Reusable GitHub Actions workflows for my repositories.

## Usage

```yaml
# .github/workflows/pr-title.yml
name: PR Title

on:
  pull_request:
    types: [opened, edited, synchronize, reopened]
    branches: [main]

permissions:
  contents: read

jobs:
  commitlint:
    uses: KostaD02/ci/.github/workflows/pr-title.yml@v1
```

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  hub:
    permissions:
      contents: read
      pull-requests: write
    uses: KostaD02/ci/.github/workflows/ci.yml@v1
    with:
      build: pnpm run build
```

`pr-version: true` stamps pull request builds with the PR number, so `1.2.0` becomes `1.2.0.22` and the popup shows which PR an artifact came from. Pushes to `main` build the plain version.

```yaml
jobs:
  hub:
    permissions:
      contents: read
      pull-requests: write
    uses: KostaD02/ci/.github/workflows/ci.yml@v1
    with:
      build: pnpm run build
      pr-version: true
```

## Workflows

| Workflow            | Does                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `ci.yml`            | Format, lint, typecheck, test, build and artifact comment in one call.                     |
| `format.yml`        | `pnpm run format:check`                                                                    |
| `lint.yml`          | `pnpm run lint`                                                                            |
| `typecheck.yml`     | `pnpm run typecheck`                                                                       |
| `test.yml`          | `pnpm run test`                                                                            |
| `node-run.yml`      | Any command in a ready workspace. The four above are thin wrappers around it.              |
| `node-build.yml`    | Build and hand the output to later jobs as an artifact, optionally with the PR version.    |
| `pr-artifact.yml`   | Republish a build as `<prefix>-PR-<n>-<commits>` and keep one sticky comment with history. |
| `pr-title.yml`      | Commitlint on the PR title.                                                                |
| `pages-preview.yml` | Static site to GitHub Pages on `main`, per-PR preview on pull requests.                    |
| `pages-cleanup.yml` | Remove the preview when the PR closes.                                                     |

| Action                             | Does                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `.github/actions/setup`            | Node, pnpm/npm/yarn, `node_modules` cache, install on a miss.             |
| `.github/actions/sticky-comment`   | Upsert one PR comment found by a marker, from a string or a file.         |
| `.github/actions/artifact-comment` | Render the artifact comment with size table and build history.            |
| `.github/actions/pr-version`       | Append the PR number to the `package.json` version, `1.2.0` → `1.2.0.22`. |

## Contributing

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/KostaD02/ci/issues).

## License

[MIT](LICENSE) © Konstantine Datunishvili
