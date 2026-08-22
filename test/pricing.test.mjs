import { test } from "node:test";
import assert from "node:assert/strict";

import {
	isDeepseek,
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
// Beijing 2026-08-17 10:00 (peak window 9:00-12:00, weekday) == UTC 02:00 the same day.
const BEIJING_PEAK_1000 = Date.UTC(2026, 7, 17, 2, 0, 0);
// Beijing 2026-08-17 03:00 (off-peak) == UTC 19:00 the previous day.
const BEIJING_OFFPEAK_0300 = Date.UTC(2026, 7, 16, 19, 0, 0);
// Beijing 2026-08-17 12:00 (boundary: peak ends at 12:00, so this is off-peak).
const BEIJING_NOON = Date.UTC(2026, 7, 17, 4, 0, 0);

// Weekend rule effective 2026-08-23 00:00 Beijing time:
// 2026-08-23 10:00 BJ (Sunday) == UTC 02:00
const BEIJING_SUNDAY_1000 = Date.UTC(2026, 7, 23, 2, 0, 0);
// 2026-08-24 10:00 BJ (Monday, weekday peak) == UTC 02:00
const BEIJING_MONDAY_1000 = Date.UTC(2026, 7, 24, 2, 0, 0);
// 2026-08-29 15:00 BJ (Saturday, weekend off-peak) == UTC 07:00
const BEIJING_SATURDAY_1500 = Date.UTC(2026, 7, 29, 7, 0, 0);

const USAGE = {
	uncachedInputTokens: 2_000_000,
	cacheReadTokens: 1_000_000,
	cacheWriteTokens: 500_000,
	outputTokens: 100_000
};

test("isDeepseek matches deepseek-* prefixes case-insensitively", () => {
	assert.equal(isDeepseek("deepseek-v4-flash"), true);
	assert.equal(isDeepseek("DeepSeek-v4-pro"), true);
	assert.equal(isDeepseek("deepseek-v4-flash-vision-exp"), true);
	assert.equal(isDeepseek("gpt-4o"), false);
	assert.equal(isDeepseek(undefined), false);
	assert.equal(isDeepseek(""), false);
});

test("priceFor picks the peak tier within a peak window on weekdays", () => {
	const { price, tier } = priceFor("deepseek-v4-flash", BEIJING_PEAK_1000);
	assert.equal(tier, "peak");
	assert.deepEqual(price, { hit: 0.1, miss: 3, output: 9 });

	const monday = priceFor("deepseek-v4-flash", BEIJING_MONDAY_1000);
	assert.equal(monday.tier, "peak");
	assert.deepEqual(monday.price, { hit: 0.1, miss: 3, output: 9 });
});

test("priceFor treats weekends as all-day off-peak from 2026-08-23 onwards", () => {
	const sunday = priceFor("deepseek-v4-flash", BEIJING_SUNDAY_1000);
	assert.equal(sunday.tier, "offpeak");
	assert.deepEqual(sunday.price, { hit: 0.05, miss: 1.5, output: 4.5 });

	const saturday = priceFor("deepseek-v4-flash-vision-exp", BEIJING_SATURDAY_1500);
	assert.equal(saturday.tier, "offpeak");
	assert.deepEqual(saturday.price, { hit: 0.05, miss: 1.5, output: 4.5 });
});

test("priceFor picks the off-peak tier outside peak windows", () => {
	const { price, tier } = priceFor("deepseek-v4-flash", BEIJING_OFFPEAK_0300);
	assert.equal(tier, "offpeak");
	assert.deepEqual(price, { hit: 0.05, miss: 1.5, output: 4.5 });
});

test("priceFor treats the 12:00 boundary as off-peak (peak ends at 12:00)", () => {
	const { tier } = priceFor("deepseek-v4-flash", BEIJING_NOON);
	assert.equal(tier, "offpeak");
});

test("priceFor supports deepseek-v4-flash-vision-exp model", () => {
	const { price, tier } = priceFor("deepseek-v4-flash-vision-exp", BEIJING_MONDAY_1000);
	assert.equal(tier, "peak");
	assert.deepEqual(price, { hit: 0.1, miss: 3, output: 9 });
});

test("priceFor falls back to flash pricing for unknown deepseek models", () => {
	const { price } = priceFor("deepseek-v4-unknown", BEIJING_PEAK_1000);
	assert.deepEqual(price, { hit: 0.1, miss: 3, output: 9 });
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
	const { cost, tier } = estimateCost(USAGE, "deepseek-v4-flash", BEIJING_OFFPEAK_0300);
	// 2.0M*1.5 + 1.5M*0.05 + 100k*4.5 = 3,525,000 / 1e6 = 3.525
	assert.equal(tier, "offpeak");
	assert.equal(cost, 3.525);
});

test("estimateCost multiplies tokens by the active tier (peak flash)", () => {
	const { cost, tier } = estimateCost(USAGE, "deepseek-v4-flash", BEIJING_PEAK_1000);
	// 2.0M*3 + 1.5M*0.1 + 100k*9 = 7,050,000 / 1e6 = 7.05
	assert.equal(tier, "peak");
	assert.equal(cost, 7.05);
});

test("estimateCost uses per-model peak prices for pro", () => {
	const { cost } = estimateCost(USAGE, "deepseek-v4-pro", BEIJING_PEAK_1000);
	// 2.0M*9 + 1.5M*0.3 + 100k*27 = 18,000,000 + 450,000 + 2,700,000 = 21,150,000 / 1e6
	assert.equal(cost, 21.15);
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
