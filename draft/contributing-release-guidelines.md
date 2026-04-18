# Contributing (Draft): Release Commit Conventions

This draft documents how commit messages map to semantic-release version bumps in the monorepo.

## Scope

These rules apply to commits merged into `main`, where the release workflow runs.

## Conventional Commits -> Version Bump

- `feat:` -> **minor** release
- `fix:` -> **patch** release
- `perf:` -> **patch** release
- `feat!:` / `fix!:` / any `type!:` -> **major** release
- `BREAKING CHANGE:` in commit body/footer -> **major** release
- Other types (e.g. `docs:`, `chore:`, `test:`, `refactor:`) -> no release by default

## Examples

- `feat(openai): support structured output` -> minor
- `fix(core): handle empty stream chunk` -> patch
- `feat!(provider): remove legacy options` -> major
- `docs: update README` -> no release

## Notes for Monorepo Releases

- The workflow uses `multi-semantic-release` to release packages independently.
- Tags use package-aware format (`${name}@${version}`), for example:
  - `@ada-pter/core@0.2.0`
  - `@ada-pter/openai@0.1.3`
