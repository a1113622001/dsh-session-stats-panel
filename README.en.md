# dsh-session-stats-panel

A DeepSeek Harness (cordis) **client plugin** that shows a stats panel for the current session on the right side of the page:

| Metric | Description |
| --- | --- |
| Average hit | Share of cache-hit input tokens (`cacheReadTokens / billed input`, accumulated across whole-round logs, 3-decimal precision) |
| Session cost | Accumulated cost estimated with DeepSeek official pricing (DeepSeek models only, see pricing below) |
| Remaining balance | DeepSeek account balance (read by the host route; the key stays server-side; refreshes every 2 minutes) |
| Runtime | Accumulated LLM + tool execution time |
| Requests | Number of closed model steps (`steps`, i.e. model request count) |
| Cumulative tokens | Input (miss) + cache-read + cache-write + output, shown with thousands separators (e.g. 3,251,237) |

The panel registers in the framework's `shell.overlay` layer (a list slot — it stacks rather than replaces any existing UI), is pinned to the right edge of the page, and collapses to a small pill when you click the "–" in the title bar.

## Data sources

- `tokenUsage` (token-meter projection) → cumulative tokens, average hit, cost;
- `sessionStats` (session-stats projection) → request count, runtime;
- The current model comes from the session models RPC (`session.models`, same source as the model picker — chat nodes carry no model field themselves);
- The remaining balance comes from the route `/plugins/session-stats-panel/balance` registered by this plugin's host half (the server resolves `DEEPSEEK_API_KEY` through the credentials service and calls the DeepSeek balance API; the key is never sent to the browser).

## Pricing

Cost is estimated in the browser with a price table built into the plugin (CNY / million tokens, fetched from the [DeepSeek official pricing page](https://api-docs.deepseek.com/zh-cn/quick_start/pricing); cache writes are billed at the cache-hit price).

**Official peak/off-peak pricing rules** (Peak windows on weekdays: Beijing time 9:00–12:00 and 14:00–18:00; off-peak is 50% discount; weekends are 100% all-day off-peak starting 2026-08-23 00:00 Beijing time):

| Model | Period | Cache-hit input | Cache-miss input | Output |
| --- | --- | --- | --- | --- |
| deepseek-v4-flash | off-peak (weekends & off-peak hours) | 0.05 | 1.5 | 4.5 |
| deepseek-v4-flash | peak (weekday peak hours) | 0.10 | 3.0 | 9.0 |
| deepseek-v4-pro | off-peak (weekends & off-peak hours) | 0.15 | 4.5 | 13.5 |
| deepseek-v4-pro | peak (weekday peak hours) | 0.30 | 9.0 | 27.0 |
| deepseek-v4-flash-vision-exp | off-peak (weekends & off-peak hours) | 0.05 | 1.5 | 4.5 |
| deepseek-v4-flash-vision-exp | peak (weekday peak hours) | 0.10 | 3.0 | 9.0 |

The plugin auto-selects the price tier at "view time" (peak / off-peak; hover the cost row to see the tier). Session cost is an **estimate**: cumulative tokens cannot be sliced by time, so the whole amount is priced with whichever tier is active at view time; any other `deepseek-*` model falls back to the flash price.

## Installation (web profile)

### Via the bundle manifest (recommended)

```bash
dsh plugin add github:a1113622001/dsh-session-stats-panel
```

The plugin ships a `cordis.patch.yml` bundle patch, so the `plugin add` command installs it as an installable plugin that activates automatically (no manual loader row needed).

### Manually from a local directory

1. Install the dependency (equivalent to `dsh plugin --profile web add <this directory>`):

   ```powershell
   corepack pnpm --dir "$env:USERPROFILE\.dsh\profiles\web" add "C:\Users\baiyec\Desktop\Harness\plugins\dsh-session-stats-panel"
   ```

2. Append a loader row to `$env:USERPROFILE\.dsh\profiles\web\cordis.patch.yml`:

   ```yaml
   - insert:
       - id: session-stats-panel
         name: 'dsh-session-stats-panel'
   ```

3. Restart the web service (`dsh web`). Afterwards, edits to `lib/client.js` are picked up by client-hot-reload (no browser refresh needed).

## Project structure

- `lib/index.js` — host half (registers the `/plugins/session-stats-panel/balance` route that resolves `DEEPSEEK_API_KEY` server-side);
- `lib/client.js` — browser half (`window.__ModuleLoader__` bundle format, registers the `shell.overlay` slot);
- `lib/pricing.js` — pure pricing/derivation/formatting logic, kept dependency-free so it can be unit-tested (mirrors the in-bundle constants in `lib/client.js`);
- `cordis.patch.yml` — bundle patch so `dsh plugin add github:...` installs and activates the plugin;
- `package.json` — declares `dsh.client.platform: "web"`; client-modules scans and serves `/plugins/dsh-session-stats-panel/client.js`.

## Development

```bash
npm test        # run the pricing/derivation unit tests
node --check lib/*.js   # syntax-check every JS file
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for house rules.

## License

[MIT](./LICENSE)
