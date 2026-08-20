window.__ModuleLoader__.load({
	id: "dsh-session-stats-panel",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		//#region styles
		/**
		* The panel is registered into the frame-wide `shell.overlay` layer
		* (absolute, inset 0, click-through). The card positions itself against the
		* right edge of the frame and opts back into pointer events. Colors come
		* from the theme token stylesheets (the presenter writes --dsw-* onto
		* document.body); the literals are only fallbacks.
		*/
		const cssId = "dsh-session-stats-panel/panel.css";
		const css = ".dssp-root{position:absolute;top:12px;right:12px;width:252px;z-index:5;pointer-events:auto;box-sizing:border-box;background:var(--dsw-specific-menu,#ffffff);border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.25));border-radius:12px;box-shadow:var(--dsw-shadow-lv3,0 6px 24px rgba(0,0,0,.15));font-family:var(--dsw-font-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif);font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary,#1f2329);overflow:hidden}.dssp-header{display:flex;align-items:center;gap:6px;padding:7px 10px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.15))}.dssp-title{font-weight:600;font-size:12px;flex:none}.dssp-model{margin-left:auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:11px;color:var(--dsw-alias-label-tertiary,#8a919f)}.dssp-toggle{flex:none;border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#8a919f);cursor:pointer;font-size:12px;line-height:14px;padding:1px 3px;border-radius:4px}.dssp-toggle:hover{color:var(--dsw-alias-label-primary,#1f2329)}.dssp-body{padding:6px 10px 8px;display:flex;flex-direction:column;gap:2px}.dssp-row{display:flex;align-items:baseline;justify-content:space-between;gap:8px}.dssp-label{color:var(--dsw-alias-label-secondary,#565e6c);flex:none}.dssp-value{font-family:var(--dsw-font-mono,ui-monospace,SFMono-Regular,Consolas,monospace);font-variant-numeric:tabular-nums;text-align:right;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dssp-note{color:var(--dsw-alias-label-tertiary,#8a919f);font-size:11px;margin-top:2px}.dssp-pill{position:absolute;top:12px;right:12px;z-index:5;pointer-events:auto;display:flex;align-items:center;gap:6px;max-width:280px;padding:4px 10px;background:var(--dsw-specific-menu,#ffffff);border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.25));border-radius:999px;box-shadow:var(--dsw-shadow-lv3,0 6px 24px rgba(0,0,0,.15));font-family:var(--dsw-font-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif);font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary,#1f2329);cursor:pointer;border:0}.dssp-pill-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(cssId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-session-stats-panel";
			tag.dataset.pluginCss = cssId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region pricing
		/**
		* DeepSeek 官方价（人民币 / 百万 tokens），抓取自官方定价页
		* https://api-docs.deepseek.com/zh-cn/quick_start/pricing（2026-08-17）。
		* 2026-08-17 00:00（北京时间）起实行峰谷定价：
		*   高峰时段 9:00-12:00、14:00-18:00；其余为空闲，空闲 = 高峰一半。
		*   deepseek-v4-flash  空闲 0.05 / 1.5 / 4.5    高峰 0.10 / 3.0 / 9.0
		*   deepseek-v4-pro    空闲 0.15 / 4.5 / 13.5   高峰 0.30 / 9.0 / 27.0
		* 缓存写入按缓存命中价计费。会话费用是估算值：累计 token 无法按时间切片，
		* 因此按“查看时刻”的峰谷档（高峰 / 空闲）整体估算。
		*
		* 本段为浏览器内联实现（client 模块加载器无法 require 相对文件，因而内联）。
		* 纯逻辑的规范版在 lib/pricing.js（可被 node --test 单测）；改价时同步两处。
		*/
		const MODELS = {
			"deepseek-v4-flash": {
				offpeak: { hit: 0.05, miss: 1.5, output: 4.5 },
				peak: { hit: 0.1, miss: 3, output: 9 }
			},
			"deepseek-v4-pro": {
				offpeak: { hit: 0.15, miss: 4.5, output: 13.5 },
				peak: { hit: 0.3, miss: 9, output: 27 }
			},
			// 其他 deepseek-* 模型按 flash 价兜底
			"*": {
				offpeak: { hit: 0.05, miss: 1.5, output: 4.5 },
				peak: { hit: 0.1, miss: 3, output: 9 }
			}
		};
		function isDeepseek(model) {
			return typeof model === "string" && model.toLowerCase().indexOf("deepseek") === 0;
		}
		/**
		* 按查看时刻（北京时间）解析峰谷价格档。
		* @returns {{ price: { hit: number, miss: number, output: number }, tier: '高峰' | '空闲' }}
		*/
		function priceFor(model, nowMs) {
			const row = MODELS[model] === void 0 ? MODELS["*"] : MODELS[model];
			const bj = new Date(nowMs + 8 * 3600e3);
			const hour = bj.getUTCHours();
			const peak = (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18);
			return { price: peak ? row.peak : row.offpeak, tier: peak ? "高峰" : "空闲" };
		}
		//#endregion
		//#region formatting
		/** Compact duration: 45.2s / 2m42s / 1h05m. */
		function formatDuration(ms) {
			const total = Math.max(0, Math.round(ms / 1e3));
			const seconds = total % 60;
			const minutes = Math.floor(total / 60) % 60;
			const hours = Math.floor(total / 3600);
			if (hours > 0) return `${hours}h${String(minutes).padStart(2, "0")}m`;
			if (minutes > 0) return `${minutes}m${seconds}s`;
			return `${Math.round(ms / 100) / 10}s`;
		}
		/** Session cost in CNY, trimmed to meaningful decimals. */
		function formatMoney(cny) {
			if (!isFinite(cny) || cny <= 0) return "¥0";
			if (cny >= 100) return `¥${cny.toFixed(0)}`;
			if (cny >= 1) return `¥${cny.toFixed(2)}`;
			if (cny >= 0.01) return `¥${cny.toFixed(3)}`;
			return `¥${cny.toFixed(4)}`;
		}
		//#endregion
		//#region derivation
		/** Sum the three disjoint prompt-side billing buckets (mirror of the shipped stats line). */
		function billedInput(usage) {
			return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
		}
		/** 缓存命中的输入占比（百分数，保留原始精度，展示时格式化）。 */
		function cacheHitPercent(usage) {
			const denominator = billedInput(usage);
			return denominator === 0 ? null : usage.cacheReadTokens / denominator * 100;
		}
		/** Total billed tokens across all four disjoint buckets. */
		function totalTokens(usage) {
			return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens + usage.outputTokens;
		}
		/** 估算会话费用（人民币）：usage × 查看时刻适用的价格档。 */
		function estimateCost(usage, model, nowMs) {
			const { price, tier } = priceFor(model, nowMs);
			const miss = usage.uncachedInputTokens * price.miss;
			const hit = (usage.cacheReadTokens + usage.cacheWriteTokens) * price.hit;
			const out = usage.outputTokens * price.output;
			return { cost: (miss + hit + out) / 1e6, tier };
		}
		/** 账户余额展示：¥9.40 或按币种拼接。 */
		function formatBalance(balances) {
			if (!Array.isArray(balances) || balances.length === 0) return "—";
			return balances.map((entry) => {
				const total = typeof entry.total === "number" ? entry.total.toFixed(2) : "0.00";
				return entry.currency === "CNY" ? `¥${total}` : `${entry.currency} ${total}`;
			}).join(" · ");
		}
		//#endregion
		//#region component
		/**
		* Root-scoped overlay card. Data comes from the current session summary
		* (`projectionValues` carries the whole host projection map — tokenUsage and
		* sessionStats among them). The model comes from the session models RPC
		* (the assembled chat nodes carry no model), and the account balance from
		* the plugin's host route. Nothing here is session-scoped, so the framework
		* standard kit supplies only `useSessions`; the sessions service and the
		* api face arrive through the registration's inject face.
		*/
		function SessionStatsPanel(props) {
			const useSessions = props.useSessions;
			const api = props.api;
			const summary = useSessions((s) => s === void 0 || s.current === void 0 ? void 0 : s.byId[s.current]);
			const sessionId = summary === void 0 ? void 0 : summary.id;
			const [collapsed, setCollapsed] = react.useState(false);
			const [model, setModel] = react.useState(void 0);
			const [balance, setBalance] = react.useState(null);
			// 当前模型：会话模型 RPC（与模型选择器同源；聊天节点不带模型字段）。
			react.useEffect(() => {
				if (sessionId === void 0 || api === void 0 || api.sessions === void 0) {
					setModel(void 0);
					return;
				}
				let alive = true;
				api.sessions.models({ sessionId }).then((res) => {
					if (!alive) return;
					const current = res !== void 0 && res.result !== void 0 && res.result.ok === true && res.result.value !== void 0 ? res.result.value.current : void 0;
					setModel(current !== void 0 && typeof current.model === "string" ? current.model : void 0);
				}).catch(() => {
					if (alive) setModel(void 0);
				});
				return () => {
					alive = false;
				};
			}, [api, sessionId]);
			// 账户余额：host 路由（key 在服务端），挂载时 + 每 2 分钟刷新。
			react.useEffect(() => {
				let alive = true;
				const load = () => {
					fetch("/plugins/session-stats-panel/balance", { cache: "no-store" }).then((res) => res.json()).then((data) => {
						if (alive) setBalance(data !== null && typeof data === "object" && data.ok === true ? data : null);
					}).catch(() => {
						if (alive) setBalance(null);
					});
				};
				load();
				const timer = setInterval(load, 120000);
				return () => {
					alive = false;
					clearInterval(timer);
				};
			}, []);
			const projections = summary === void 0 ? void 0 : summary.projectionValues;
			const usage = projections === void 0 ? void 0 : projections.tokenUsage;
			const stats = projections === void 0 ? void 0 : projections.sessionStats;
			if (summary === void 0 || summary.blank) return null;
			const tokens = usage === void 0 ? null : totalTokens(usage);
			const hit = usage === void 0 ? null : cacheHitPercent(usage);
			const runtimeMs = stats === void 0 ? 0 : stats.llmMs + stats.toolMs;
			const requests = stats === void 0 ? 0 : stats.steps;
			const costInfo = usage !== void 0 && model !== void 0 && isDeepseek(model) ? estimateCost(usage, model, Date.now()) : null;
			const cost = costInfo === null ? null : costInfo.cost;
			const costTitle = model !== void 0 && !isDeepseek(model) ? "仅 DeepSeek 模型参与计费" : costInfo === null ? "DeepSeek 官方价估算（见插件 MODELS 常量）" : `DeepSeek 官方价估算（${costInfo.tier}时段价，见插件 MODELS 常量）`;
			const balanceValue = balance === null ? "—" : formatBalance(balance.balances);
			const modelLabel = model === void 0 ? "" : model;
			const close = collapsed ? (0, react.createElement)("button", {
				type: "button",
				className: "dssp-toggle",
				title: "展开会话统计",
				onClick: () => setCollapsed(false)
			}, "+") : (0, react.createElement)("button", {
				type: "button",
				className: "dssp-toggle",
				title: "收起会话统计",
				onClick: () => setCollapsed(true)
			}, "–");
			if (collapsed) return (0, react.createElement)("button", {
				type: "button",
				className: "dssp-pill",
				title: "展开会话统计",
				onClick: () => setCollapsed(false)
			}, (0, react.createElement)("span", { className: "dssp-pill-label" }, "会话统计"), (0, react.createElement)("span", { className: "dssp-pill-label" }, modelLabel || ""));
			const row = (label, value, title) => (0, react.createElement)("div", {
				className: "dssp-row",
				title: title
			}, (0, react.createElement)("span", { className: "dssp-label" }, label), (0, react.createElement)("span", { className: "dssp-value" }, value));
			return (0, react.createElement)("div", {
				className: "dssp-root",
				"data-dsh-session-stats": true
			}, (0, react.createElement)("div", {
				className: "dssp-header"
			}, (0, react.createElement)("span", { className: "dssp-title" }, "会话统计"), (0, react.createElement)("span", {
				className: "dssp-model",
				title: modelLabel
			}, modelLabel), close), (0, react.createElement)("div", {
				className: "dssp-body"
			}, row("平均命中", hit === null ? "—" : `${hit.toFixed(3)}%`, "缓存命中的输入占比（cacheRead / 计费输入）"), row("会话费用", cost === null ? "—" : formatMoney(cost), costTitle), row("剩余余额", balanceValue, balance === null ? "余额读取失败（host 路由未生效或未配置 DeepSeek key）" : `DeepSeek 账户余额（每 2 分钟刷新，${balance.updatedAt || ""}）`), row("运行时间", runtimeMs > 0 ? formatDuration(runtimeMs) : "—", "累计模型 + 工具执行时长"), row("请求数", requests > 0 ? String(requests) : "—", stats === void 0 ? "" : `共 ${stats.turns} 轮 / ${stats.steps} 次模型请求`), row("累计 Tokens", tokens === null ? "—" : tokens.toLocaleString("en-US"), "输入(未命中) + 缓存读 + 缓存写 + 输出")));
		}
		//#endregion
		//#region entry
		/** Required services for the fiber (slots for registration, sessions for the model RPC, connection for the api face). */
		const inject = ["slots", "sessions", "connection"];
		/**
		* Client plugin body: register the stats card into the additive frame-wide
		* overlay layer (right edge of the page). No replacement of any shipped
		* occupant — `shell.overlay` is a list slot.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			const sessions = ctx.sessions;
			const connection = ctx.get("connection");
			const api = connection === void 0 ? void 0 : connection.api;
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "session-stats-panel",
				order: 0,
				inject: () => ({ sessions, api })
			}, SessionStatsPanel));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
