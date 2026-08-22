<div align="center">

# 📊 dsh-session-stats-panel
### 💰 DeepSeek Harness 实时会话统计 · 官方峰谷计费 · 账户余额看板插件

[![Release](https://img.shields.io/npm/v/dsh-session-stats-panel?style=flat-square&color=blue&logo=npm)](https://www.npmjs.com/package/dsh-session-stats-panel)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D20-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

[English](./README.en.md) · [简体中文](./README.md)

</div>

---

## 📖 项目简介

**dsh-session-stats-panel** 是为 DeepSeek Harness 设计的会话计量与成本监控客户端插件。

无侵入式挂载在页面右侧，实时展示当前会话的 **Token 缓存命中率**、**官方峰谷计费估算**、**DeepSeek 官方账户余额**、**运行时长** 与 **累计 Tokens**，让大模型 Agent 开发的成本与效率一目了然。

---

## 📊 监控指标看板

| 核心指标 | 数据源与计算方式 | 业务价值 |
| :--- | :--- | :--- |
| **平均命中率** | `cacheReadTokens / 计费输入 Tokens` | 直观评估 Prompt Caching 优化效果 |
| **会话估算费用** | 按照 DeepSeek 官方峰谷价格表动态计算 | 精确核算单次 Agent 任务运行成本 |
| **剩余账户余额** | 服务端凭据隔离路由拉取（每 2 分钟刷新） | 避免 Key 暴露前端的同时实时监控余额 |
| **累计 Tokens** | 未命中输入 + 缓存读写 + 输出（千分位展示） | 掌握上下文膨胀与消耗规模 |
| **模型请求次数** | 会话中模型调用步骤（`steps`）计数 | 监控 Agent 思考轮数与工具调用频次 |

---

## 🕒 2026 官方最新峰谷定价支持

插件内置 DeepSeek 官方峰谷计费规则（按北京时间自动切换）：
- **高峰时段**（09:00–12:00，14:00–18:00）：按标准基准价计费；
- **空闲时段**（其余时段）：**全线 5 折半价计费**。

---

## 🚀 安装与启用

```bash
dsh plugin add github:a1113622001/dsh-session-stats-panel
```

---

## 📄 开源许可证

本项目采用 [MIT License](LICENSE) 授权开源。
