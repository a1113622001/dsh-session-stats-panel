/**
 * Pure DeepSeek pricing, token-derivation and display-formatting helpers for the
 * dsh-session-stats-panel browser plugin.
 *
 * This module is intentionally dependency-free (no `window`, no module-loader
 * shims) so it can be imported and unit-tested with plain Node:
 *
 *     node --test test/pricing.test.mjs
 *
 * It is the canonical reference for the pricing math. The browser half
 * (`lib/client.js`) keeps an identical inline copy of these functions because
 * the client module loader only resolves platform seed words / registered
 * factories — it cannot `require` a sibling file on disk. Keep the two in sync
 * when the price table changes; the constants below are the single spec.
 */

/** DeepSeek official prices, CNY per million tokens. */
const MODELS = {
	"deepseek-v4-flash": {
		offpeak: { hit: 0.05, miss: 1.5, output: 4.5 },
		peak: { hit: 0.1, miss: 3, output: 9 }
	},
	"deepseek-v4-pro": {
		offpeak: { hit: 0.15, miss: 4.5, output: 13.5 },
		peak: { hit: 0.3, miss: 9, output: 27 }
	},
	// Any other deepseek-* model falls back to the flash price.
	"*": {
		offpeak: { hit: 0.05, miss: 1.5, output: 4.5 },
		peak: { hit: 0.1, miss: 3, output: 9 }
	}
};

/** Peak schedule, Beijing time (milliseconds past Beijing midnight are derived by shifting from UTC). */
const PEAK_SCHEDULE = {
	// Beijing local hour → whether it is a peak window.
	isPeakHour(hour) {
		return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18);
	}
};

/** True for any model id that starts with "deepseek" (case-insensitive). */
export function isDeepseek(model) {
	return typeof model === "string" && model.toLowerCase().indexOf("deepseek") === 0;
}

/**
 * Resolve the active peak/off-peak price tier for a model at a given instant.
 * All times are interpreted as Beijing time (UTC+8), matching the shipped tier.
 * @param {string} model
 * @param {number} nowMs epoch millis
 * @returns {{ price: { hit: number, miss: number, output: number }, tier: 'peak' | 'offpeak' }}
 */
export function priceFor(model, nowMs) {
	const row = MODELS[model] === void 0 ? MODELS["*"] : MODELS[model];
	const bj = new Date(nowMs + 8 * 3600e3);
	const hour = bj.getUTCHours();
	const peak = PEAK_SCHEDULE.isPeakHour(hour);
	return { price: peak ? row.peak : row.offpeak, tier: peak ? "peak" : "offpeak" };
}

/** Sum the three disjoint prompt-side billing buckets (mirror of the shipped stats line). */
export function billedInput(usage) {
	return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
}

/** Cache-hit input share, as a percentage (null when there is no billed input). */
export function cacheHitPercent(usage) {
	const denominator = billedInput(usage);
	return denominator === 0 ? null : (usage.cacheReadTokens / denominator) * 100;
}

/** Total billed tokens across all four disjoint buckets. */
export function totalTokens(usage) {
	return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens + usage.outputTokens;
}

/**
 * Estimate the session cost in CNY for a model at a given instant.
 * Cache writes are billed at the cache-hit price.
 * @returns {{ cost: number, tier: 'peak' | 'offpeak' }}
 */
export function estimateCost(usage, model, nowMs) {
	const { price, tier } = priceFor(model, nowMs);
	const miss = usage.uncachedInputTokens * price.miss;
	const hit = (usage.cacheReadTokens + usage.cacheWriteTokens) * price.hit;
	const out = usage.outputTokens * price.output;
	return { cost: (miss + hit + out) / 1e6, tier };
}

/** Compact duration: 45.2s / 2m42s / 1h05m. */
export function formatDuration(ms) {
	const total = Math.max(0, Math.round(ms / 1e3));
	const seconds = total % 60;
	const minutes = Math.floor(total / 60) % 60;
	const hours = Math.floor(total / 3600);
	if (hours > 0) return `${hours}h${String(minutes).padStart(2, "0")}m`;
	if (minutes > 0) return `${minutes}m${seconds}s`;
	return `${Math.round(ms / 100) / 10}s`;
}

/** Session cost in CNY, trimmed to meaningful decimals. */
export function formatMoney(cny) {
	if (!isFinite(cny) || cny <= 0) return "¥0";
	if (cny >= 100) return `¥${cny.toFixed(0)}`;
	if (cny >= 1) return `¥${cny.toFixed(2)}`;
	if (cny >= 0.01) return `¥${cny.toFixed(3)}`;
	return `¥${cny.toFixed(4)}`;
}

/** Account balance display, e.g. ¥9.40 or multi-currency joined by " · ". */
export function formatBalance(balances) {
	if (!Array.isArray(balances) || balances.length === 0) return "—";
	return balances
		.map((entry) => {
			const total = typeof entry.total === "number" ? entry.total.toFixed(2) : "0.00";
			return entry.currency === "CNY" ? `¥${total}` : `${entry.currency} ${total}`;
		})
		.join(" · ");
}
