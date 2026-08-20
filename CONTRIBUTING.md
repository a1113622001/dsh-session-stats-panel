# Contributing to dsh-session-stats-panel

Thanks for contributing! This repo is a DeepSeek Harness (cordis) client plugin
that renders a right-side session stats panel. All contributions are welcome.

## Getting started

No runtime dependencies — the plugin is plain ESM JavaScript run by the harness.

```bash
# Run the unit tests (pricing schedule, token derivation, formatters)
npm test

# Syntax-check every source file exactly as CI does
for f in lib/*.js test/*.mjs; do node --check "$f"; done
```

## House rules

- **Commit messages** use [Conventional Commits](https://www.conventionalcommits.org/)
  (e.g. `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `ci:`, `chore:`). Keep
  each commit one logical change.
- **Do not break the plugin.** `lib/index.js` (host half) and `lib/client.js`
  (browser half) must keep their exported `inject`/`apply` contract — the
  harness activates them on install.
- **Keep the two pricing copies in sync.** The pure pricing/token-derivation
  logic lives canonically in `lib/pricing.js` (dependency-free, unit-tested).
  `lib/client.js` keeps an identical inline copy because the client module
  loader cannot `require` a sibling file. When you change prices or the peak
  schedule, update **both** and extend `test/pricing.test.mjs`.
- **Add tests** for any pure logic; run `npm test` and confirm green before
  committing.

## Submitting changes

1. Create a feature branch: `git checkout -b <branch>`.
2. Make your changes and commit them with a conventional message.
3. Push to your fork and open a pull request against `main`.

The CI workflow runs a syntax check, validates that `package.json` carries the
`dsh.bundle` manifest, and executes the unit test suite on every push / PR.
