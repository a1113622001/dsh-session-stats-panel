// Host half of dsh-session-stats-panel: serves the account balance that the
// browser panel displays. The API key stays server-side — resolved through
// the credentials service exactly like the deepseek-official adapter does —
// and the browser only ever GETs the JSON this route returns.
//
// `inject: ['webServer']` is load-bearing: without a declared dependency the
// fiber activates the moment its module loads, which can race the webServer
// service and silently skip the route (ctx.get('webServer') was undefined at
// apply time → the balance route never registered). Declaring the service
// parks the fiber until webServer exists.
export const inject = ["webServer"];

let balanceCache = { at: 0, body: null };
const CACHE_TTL_MS = 60_000;

export function apply(ctx) {
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/plugins/session-stats-panel/balance",
		handler: async (req, res) => {
			if (req.method !== "GET" && req.method !== "HEAD") {
				res.writeHead(405);
				res.end();
				return;
			}
			const now = Date.now();
			if (balanceCache.body === null || now - balanceCache.at > CACHE_TTL_MS) {
				balanceCache = { at: now, body: await fetchBalance(ctx) };
			}
			res.writeHead(200, {
				"content-type": "application/json; charset=utf-8",
				"cache-control": "no-store"
			});
			res.end(JSON.stringify(balanceCache.body));
		}
	}), "session-stats-panel: balance route");
}

async function fetchBalance(ctx) {
	try {
		let key;
		const credentials = ctx.get("credentials");
		if (credentials !== void 0) {
			const hit = await credentials.resolve("DEEPSEEK_API_KEY");
			key = hit !== void 0 && typeof hit.value === "string" ? hit.value : void 0;
		}
		if (!key) key = process.env.DEEPSEEK_API_KEY;
		if (!key) return { ok: false, error: "no DeepSeek API key (credentials service or DEEPSEEK_API_KEY env)" };
		const res = await fetch("https://api.deepseek.com/user/balance", {
			headers: { Authorization: `Bearer ${key}` },
			signal: AbortSignal.timeout(15000)
		});
		if (!res.ok) return { ok: false, error: `balance API HTTP ${res.status}` };
		const payload = await res.json();
		const infos = Array.isArray(payload?.balance_infos) ? payload.balance_infos : [];
		return {
			ok: true,
			isAvailable: payload?.is_available === true,
			balances: infos
				.filter((entry) => entry !== null && typeof entry === "object" && typeof entry.total_balance === "string")
				.map((entry) => ({
					currency: typeof entry.currency === "string" ? entry.currency : "CNY",
					total: Number.parseFloat(entry.total_balance)
				})),
			updatedAt: new Date().toISOString()
		};
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}
