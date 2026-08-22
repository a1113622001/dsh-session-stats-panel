# Changelog

All notable changes to this project are documented in this file.

## [0.1.1] - 2026-08-23

- Update official pricing table: add `deepseek-v4-flash-vision-exp` support.
- Implement 2026-08-23 official peak/off-peak rule: weekends (Saturday & Sunday) are 100% all-day off-peak (50% discount).
- Fix client session state hook resolution via `react.useSyncExternalStore` for robust initial mounting.
- Fix Windows ESM file URL loading in `check-pricing-sync.mjs`.

## [0.1.0] - 2026-08-20

- Initial release. Adds a right-side session stats panel to the DSH web GUI:
  average cache-hit rate, session cost (DeepSeek pricing), account balance,
  runtime, request count and cumulative tokens.
- Registered as an installable bundle so it activates with `dsh plugin add`.
- Extract the pricing/peak-schedule logic into a testable `lib/pricing.js`.
