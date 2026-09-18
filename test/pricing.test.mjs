import { test } from "node:test";
import assert from "node:assert/strict";

import {
	isDeepseek,
	modelKey,
	isPeakTime,
	priceFor,
	billedInput,
	cacheHitPercent,
	totalTokens,
	estimateCost,
	formatDuration,
	formatMoney,
	formatBalance
} from "../lib/pricing.js";

// Beijing time = UTC+8.
// Beijing 2026-08-17 10:00 (peak window 9:00-12:00, Monday) == UTC 02:00 the same day.
const BEIJING_PEAK_1000 = Date.UTC(2026, 7, 17, 2, 0, 0);
// Beijing 2026-08-17 03:00 (off-peak) == UTC 19:00 the previous day.
const BEIJING_OFFPEAK_0300 = Date.UTC(2026, 7, 16, 19, 0, 0);
// Beijing 2026-08-17 12:00 (boundary: peak ends at 12:00, so this is off-peak).
const BEIJING_NOON = Date.UTC(2026, 7, 17, 4, 0, 0);
// Beijing 2026-08-17 14:00 (boundary: the afternoon peak window opens at 14:00).
const BEIJING_1400 = Date.UTC(2026, 7, 17, 6, 0, 0);

// Weekends are all-day off-peak under the current official rule.
// 2026-08-23 10:00 BJ (Sunday) == UTC 02:00
const BEIJING_SUNDAY_1000 = Date.UTC(2026, 7, 23, 2, 0, 0);
// 2026-08-24 10:00 BJ (Monday, weekday peak) == UTC 02:00
const BEIJING_MONDAY_1000 = Date.UTC(2026, 7, 24, 2, 0, 0);
// 2026-08-29 15:00 BJ (Saturday, weekend off-peak) == UTC 07:00
const BEIJING_SATURDAY_1500 = Date.UTC(2026, 7, 29, 7, 0, 0);

// Current official Flash prices (CNY / million tokens).
const FLASH_OFFPEAK = { hit: 0.02, miss: 1, output: 4 };
const FLASH_PEAK = { hit: 0.04, miss: 2, output: 8 };
const PRO_OFFPEAK = { hit: 0.15, miss: 4.5, output: 13.5 };
const PRO_PEAK = { hit: 0.3, miss: 9, output: 27 };

/**
 * Build the Date shape `isPeakTime` expects: a Date whose *UTC* fields carry
 * the Beijing wall-clock time (this is exactly what `priceFor` hands it after
 * shifting by +8h).
 */
function beijing(y, m, d, h, min = 0) {
	return new Date(Date.UTC(y, m - 1, d, h, min));
}

const USAGE = {
	uncachedInputTokens: 2_000_000,
	cacheReadTokens: 1_000_000,
	cacheWriteTokens: 500_000,
	outputTokens: 100_000
};

test("isDeepseek matches deepseek-* prefixes case-insensitively", () => {
	assert.equal(isDeepseek("deepseek-flash"), true);
	assert.equal(isDeepseek("deepseek-v4-flash"), true);
	assert.equal(isDeepseek("DeepSeek-v4-pro"), true);
	assert.equal(isDeepseek("deepseek-v4-flash-vision-exp"), true);
	assert.equal(isDeepseek("gpt-4o"), false);
	assert.equal(isDeepseek(undefined), false);
	assert.equal(isDeepseek(""), false);
});

test("modelKey resolves exact ids, versioned ids and the fallback", () => {
	assert.equal(modelKey("deepseek-flash"), "deepseek-flash");
	assert.equal(modelKey("deepseek-v4-pro"), "deepseek-v4-pro");
	// Versioned / pinned builds resolve to their family instead of the "*" fallback.
	assert.equal(modelKey("deepseek-v4-pro-0813"), "deepseek-v4-pro");
	assert.equal(modelKey("deepseek-v4-flash-0731"), "deepseek-flash");
	assert.equal(modelKey("deepseek-v4-flash-latest"), "deepseek-flash");
	assert.equal(modelKey("deepseek-chat"), "deepseek-flash");
	assert.equal(modelKey("gpt-4o"), "*");
	assert.equal(modelKey(undefined), "*");
});

test("isPeakTime only opens on weekday peak windows (Beijing time)", () => {
	assert.equal(isPeakTime(beijing(2026, 8, 17, 10)), true); // Monday morning window
	assert.equal(isPeakTime(beijing(2026, 8, 17, 14)), true); // Monday afternoon window
	assert.equal(isPeakTime(beijing(2026, 8, 17, 3)), false); // Monday, before the window
	assert.equal(isPeakTime(beijing(2026, 8, 17, 12)), false); // Monday, the 12:00 boundary
	assert.equal(isPeakTime(beijing(2026, 8, 17, 18)), false); // Monday, the 18:00 boundary
	assert.equal(isPeakTime(beijing(2026, 8, 23, 10)), false); // Sunday
	assert.equal(isPeakTime(beijing(2026, 8, 29, 15)), false); // Saturday
});

test("priceFor picks the peak tier within a weekday peak window", () => {
	const { price, tier } = priceFor("deepseek-flash", BEIJING_PEAK_1000);
	assert.equal(tier, "peak");
	assert.deepEqual(price, FLASH_PEAK);

	const monday = priceFor("deepseek-v4-flash", BEIJING_MONDAY_1000);
	assert.equal(monday.tier, "peak");
	assert.deepEqual(monday.price, FLASH_PEAK);

	const afternoon = priceFor("deepseek-flash", BEIJING_1400);
	assert.equal(afternoon.tier, "peak");
	assert.deepEqual(afternoon.price, FLASH_PEAK);
});

test("priceFor treats weekends as all-day off-peak", () => {
	const sunday = priceFor("deepseek-flash", BEIJING_SUNDAY_1000);
	assert.equal(sunday.tier, "offpeak");
	assert.deepEqual(sunday.price, FLASH_OFFPEAK);

	const saturday = priceFor("deepseek-v4-flash-vision-exp", BEIJING_SATURDAY_1500);
	assert.equal(saturday.tier, "offpeak");
	assert.deepEqual(saturday.price, FLASH_OFFPEAK);
});

test("priceFor picks the off-peak tier outside peak windows", () => {
	const { price, tier } = priceFor("deepseek-flash", BEIJING_OFFPEAK_0300);
	assert.equal(tier, "offpeak");
	assert.deepEqual(price, FLASH_OFFPEAK);
});

test("priceFor treats the 12:00 boundary as off-peak (peak ends at 12:00)", () => {
	const { tier } = priceFor("deepseek-flash", BEIJING_NOON);
	assert.equal(tier, "offpeak");
});

test("priceFor bills legacy flash ids at the current flash price", () => {
	const legacy = priceFor("deepseek-v4-flash", BEIJING_MONDAY_1000);
	assert.equal(legacy.tier, "peak");
	assert.deepEqual(legacy.price, FLASH_PEAK);

	const vision = priceFor("deepseek-v4-flash-vision-exp", BEIJING_MONDAY_1000);
	assert.deepEqual(vision.price, FLASH_PEAK);
});

test("priceFor bills versioned pro ids at the pro price, not the flash fallback", () => {
	const { price, tier } = priceFor("deepseek-v4-pro-0813", BEIJING_PEAK_1000);
	assert.equal(tier, "peak");
	assert.deepEqual(price, PRO_PEAK);

	const off = priceFor("deepseek-v4-pro-0813", BEIJING_OFFPEAK_0300);
	assert.deepEqual(off.price, PRO_OFFPEAK);
});

test("priceFor falls back to flash pricing for unknown deepseek models", () => {
	const { price } = priceFor("deepseek-v4-unknown", BEIJING_PEAK_1000);
	assert.deepEqual(price, FLASH_PEAK);
});

test("billedInput sums the three prompt-side buckets", () => {
	assert.equal(billedInput(USAGE), 3_500_000);
});

test("cacheHitPercent returns the cache-read share as a percentage", () => {
	assert.equal(cacheHitPercent(USAGE), (1_000_000 / 3_500_000) * 100);
});

test("cacheHitPercent returns null when there is no billed input", () => {
	assert.equal(cacheHitPercent({ uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }), null);
});

test("totalTokens sums all four disjoint buckets", () => {
	assert.equal(totalTokens(USAGE), 3_600_000);
});

test("estimateCost multiplies tokens by the active tier (off-peak flash)", () => {
	const { cost, tier } = estimateCost(USAGE, "deepseek-flash", BEIJING_OFFPEAK_0300);
	// 2.0M*1 + 1.5M*0.02 + 100k*4 = 2,430,000 / 1e6 = 2.43
	assert.equal(tier, "offpeak");
	assert.equal(cost, 2.43);
});

test("estimateCost multiplies tokens by the active tier (peak flash)", () => {
	const { cost, tier } = estimateCost(USAGE, "deepseek-flash", BEIJING_PEAK_1000);
	// 2.0M*2 + 1.5M*0.04 + 100k*8 = 4,860,000 / 1e6 = 4.86
	assert.equal(tier, "peak");
	assert.equal(cost, 4.86);
});

test("estimateCost uses per-model peak prices for pro", () => {
	const { cost } = estimateCost(USAGE, "deepseek-v4-pro", BEIJING_PEAK_1000);
	// 2.0M*9 + 1.5M*0.3 + 100k*27 = 21,150,000 / 1e6
	assert.equal(cost, 21.15);
});

test("estimateCost uses per-model off-peak prices for pro", () => {
	const { cost } = estimateCost(USAGE, "deepseek-v4-pro", BEIJING_OFFPEAK_0300);
	// 2.0M*4.5 + 1.5M*0.15 + 100k*13.5 = 10,575,000 / 1e6
	assert.equal(cost, 10.575);
});

test("formatDuration renders compact seconds / minutes / hours", () => {
	assert.equal(formatDuration(45_200), "45.2s");
	assert.equal(formatDuration(162_000), "2m42s");
	assert.equal(formatDuration(3_930_000), "1h05m");
	assert.equal(formatDuration(0), "0s");
});

test("formatMoney trims to meaningful decimals", () => {
	assert.equal(formatMoney(150), "¥150");
	assert.equal(formatMoney(9.4), "¥9.40");
	assert.equal(formatMoney(0.95), "¥0.950");
	assert.equal(formatMoney(0), "¥0");
	assert.equal(formatMoney(-5), "¥0");
});

test("formatBalance renders currencies and joins multi-currency balances", () => {
	assert.equal(formatBalance([{ currency: "CNY", total: 9.4 }]), "¥9.40");
	assert.equal(
		formatBalance([
			{ currency: "CNY", total: 9.4 },
			{ currency: "USD", total: 12 }
		]),
		"¥9.40 · USD 12.00"
	);
	assert.equal(formatBalance([]), "—");
	assert.equal(formatBalance(undefined), "—");
});
