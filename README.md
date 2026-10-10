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

## Workflows

| Workflow            | Does                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `ci.yml`            | Format, lint, typecheck, test, build, artifact comment and Pages in one call.              |
| `format.yml`        | `pnpm run format:check`                                                                    |
| `lint.yml`          | `pnpm run lint`                                                                            |
| `typecheck.yml`     | `pnpm run typecheck`                                                                       |
| `test.yml`          | `pnpm run test`                                                                            |
| `node-run.yml`      | Any command in a ready workspace. The four above are thin wrappers around it.              |
| `node-build.yml`    | Build and hand the output to later jobs as an artifact.                                    |
| `pr-artifact.yml`   | Republish a build as `<prefix>-PR-<n>-<commits>` and keep one sticky comment with history. |
| `pr-title.yml`      | Commitlint on the PR title.                                                                |
| `pages-preview.yml` | Static site to GitHub Pages on `main`, per-PR preview on pull requests.                    |
| `pages-cleanup.yml` | Remove the preview when the PR closes.                                                     |

| Action                             | Does                                                              |
| ---------------------------------- | ----------------------------------------------------------------- |
| `.github/actions/setup`            | Node, pnpm/npm/yarn, `node_modules` cache, install on a miss.     |
| `.github/actions/sticky-comment`   | Upsert one PR comment found by a marker, from a string or a file. |
| `.github/actions/artifact-comment` | Render the artifact comment with size table and build history.    |

## Contributing

Bug reports and feature requests are welcome via [GitHub Issues](https://github.com/KostaD02/ci/issues).

Please refer to the [Contributing Guidelines](CONTRIBUTING.md) for the development setup and the process for submitting pull requests.

## License

[MIT](LICENSE) © Konstantine Datunishvili
