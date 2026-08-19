# dsh-session-stats-panel

DeepSeek Harness (cordis) **client plugin**：在页面右侧显示当前会话的统计面板：

| 指标 | 说明 |
| --- | --- |
| 平均命中 | 缓存命中的输入占比（`cacheReadTokens / 计费输入`，整轮日志累计，保留 3 位小数） |
| 会话费用 | 按 DeepSeek 官方价估算的累计费用（仅 DeepSeek 模型，见下方定价） |
| 剩余余额 | DeepSeek 账户余额（host 路由读取，key 在服务端；每 2 分钟刷新） |
| 运行时间 | 累计模型 + 工具执行时长 |
| 请求数 | 已关闭的模型步骤数（`steps`，即模型请求次数） |
| 累计 Tokens | 输入（未命中）+ 缓存读 + 缓存写 + 输出，千分位展示（如 3,251,237） |

面板注册在框架的 `shell.overlay` 叠加层（list 槽，可叠加、不替换任何现有 UI），固定于页面右侧，可点击标题栏「–」收起为一个小胶囊。

## 数据来源

- `tokenUsage`（token-meter 投影）→ 累计 tokens、平均命中、费用；
- `sessionStats`（session-stats 投影）→ 请求数、运行时间；
- 当前模型来自会话模型 RPC（`session.models`，与模型选择器同源——聊天节点本身不带模型字段）；
- 剩余余额来自本插件 host 半边注册的路由 `/plugins/session-stats-panel/balance`（服务端通过 credentials 服务解析 `DEEPSEEK_API_KEY` 后调用 DeepSeek 余额接口，key 不下发到浏览器）。

## 定价

费用在浏览器端按 [DeepSeek 官方定价页](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)（2026-08-14 抓取）内置的价格表估算（人民币 / 百万 tokens，缓存写入按缓存命中价计费）。

**现行价**（2026-08-17 00:00 北京时间前生效）：

| 模型 | 缓存命中输入 | 缓存未命中输入 | 输出 |
| --- | --- | --- | --- |
| deepseek-v4-flash | 0.02 | 1 | 2 |
| deepseek-v4-pro | 0.025 | 3 | 6 |

**2026-08-17 00:00 起改为峰谷定价**（高峰：北京时间 9:00–12:00、14:00–18:00；其余空闲，空闲 = 高峰一半）：

| 模型 | 时段 | 缓存命中输入 | 缓存未命中输入 | 输出 |
| --- | --- | --- | --- | --- |
| deepseek-v4-flash | 空闲 | 0.05 | 1.5 | 4.5 |
| deepseek-v4-flash | 高峰 | 0.10 | 3.0 | 9.0 |
| deepseek-v4-pro | 空闲 | 0.15 | 4.5 | 13.5 |
| deepseek-v4-pro | 高峰 | 0.30 | 9.0 | 27.0 |

插件在「查看时刻」自动选择价格档（现行 / 高峰 / 空闲，悬停费用行可见档位）。会话费用为**估算值**：累计 token 无法按时间切片，因此按当前适用档整体计价；其他 `deepseek-*` 模型按 flash 现行价兜底。价格变动时修改 `lib/client.js` 的 `PRICES` / `PEAK_PRICES` / `OFFPEAK_PRICES` / `PEAK_SCHEDULE_START` 常量即可（client-hmr 会热更新，无需重启）。

## 安装（web 配置档）

1. 安装依赖（等价于 `dsh plugin --profile web add <本目录>`）：

   ```powershell
   corepack pnpm --dir "$env:USERPROFILE\.dsh\profiles\web" add "C:\Users\baiyec\Desktop\Harness\plugins\dsh-session-stats-panel"
   ```

2. 在 `$env:USERPROFILE\.dsh\profiles\web\cordis.patch.yml` 中追加 loader 行：

   ```yaml
   - insert:
       - id: session-stats-panel
         name: 'dsh-session-stats-panel'
   ```

3. 重启 web 服务（`dsh web`）。此后修改 `lib/client.js` 会被 client-hmr 轮询热更新（浏览器无需刷新）。

## 结构

- `lib/index.js` — host 半边（空实现，仅为让 Loader 挂载该条目）；
- `lib/client.js` — 浏览器半边（`window.__ModuleLoader__` 包格式，注册 `shell.overlay` 槽）；
- `package.json` — `dsh.client.platform: "web"` 声明，client-modules 据此扫描并服务 `/plugins/dsh-session-stats-panel/client.js`。
