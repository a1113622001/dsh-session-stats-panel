# Changelog

All notable changes to this project are documented in this file.

## [0.1.2] - 2026-09-18

- Update the pricing table to the 2026-09-18 official rates: Flash drops to
  0.02 / 1 / 4 (off-peak) and 0.04 / 2 / 8 (peak, CNY per million tokens); Pro is unchanged.
- Follow the new official id `deepseek-flash` (DeepSeek-V4.1-Flash); the retired
  `deepseek-v4-flash` / `deepseek-v4-flash-vision-exp` ids stay at Flash prices
  because DeepSeek still serves them with V4.1-Flash.
- Restate the peak rule as weekdays-only (Mon–Fri 09:00–12:00, 14:00–18:00 Beijing time).
  Weekends remain all-day off-peak, so the dated 2026-08-23 special case is gone.
- Resolve versioned model ids (`deepseek-v4-pro-0813`, `deepseek-v4-flash-0731`)
  to their price family instead of the cheaper Flash fallback.
- Wire the behavioural parity probe in `check-pricing-sync.mjs` into the report —
  it was defined but never called, so it could not catch anything.

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
