# 雇主品牌社交媒体倾听平台（Employer Brand Social Listening）

企业雇主品牌社交媒体倾听平台 —— 全球范围覆盖、中国为主阵地。用户设置企业背景信息后，系统采集相关舆情与评论，进行方面级情感分析，提供深度分析报告（Dashboard）与对策、行动计划，形成「倾听 → 分析 → 预警 → 对策 → 行动」完整闭环。

> 演示主体：三七互娱（游戏行业）。数据为内置种子（回溯 90 天故事线，确定性生成，可复现），用于原型演示；生产环境接入真实采集层（参考 PRD 技术选型：MediaCrawler / Crawlee / Scrapy 等）即可。

## 技术形态

- **后端**：零依赖 Node HTTP 服务（`server/`，无需 `npm install`）。JSON 文件持久化（`data/db.json`，缺失时自动重建种子）。
- **前端**：原生 SPA（`public/`），严格遵循 Material Design 3（m3.material.io）—— 色彩/类型/形状/状态层令牌、导航栏、应用栏、卡片、芯片、对话框、Snackbar、明暗双主题；图表均为手写 SVG（无第三方库）。

## 本地运行

```bash
node server/server.js
# 默认端口 8321；部署到 Render 等平台时读取环境变量 PORT
# 打开 http://localhost:8321
```

## 页面结构（9 个）

综合概览 · 方面口碑 · 竞品对标 · 候选人视角 · 预警中心 · 原声明细 · 行动看板 · 分析报告 · 配置中心

## 核心指标

- **EBHI** 雇主品牌健康度指数（0–100，六方面加权 + 平台覆盖/影响力修正）
- **NSR** 净情感比（-1–1）、**SOV** 声量份额
- 方面级情感雷达、周度趋势、热点话题榜、竞品横评热力图、行动闭环看板

## 部署

仓库根含 `render.yaml`（Render Blueprint）/ `.renderignore`。部署到 Render：控制台 New → Web Service → Connect 本仓库 → 选 `render.yaml`，或手动设置：
- Runtime: Node
- Build Command: （留空）
- Start Command: `node server/server.js`
- Health Check: `/api/company`
- 环境变量：`NODE_ENV=production`

## 合规

仅采集未登录公开内容、入库即去标识化、全局配额限速；PIPL / 数据安全法 DPIA、GDPR（海外区）评估。演示数据已脱敏。
