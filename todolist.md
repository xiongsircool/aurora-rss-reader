# RSS 管理工具 · Todo List（Vue 本地 MVP）

> 目标：以 Vue 3 + Vite 打造一个“本地运行、单应用”最小可用版本，先完成阅读体验与基础 AI 辅助，再考虑扩展。

## 1. 技术栈与脚手架
- [x] 初始化 `Vue 3 + Vite + TypeScript` 前端（Pinia + Vue Router）；`rss-desktop/` 由 `create-electron-vite` 搭建完成。
- [x] 完成 Electron + Vite 容器，主进程负责窗口管理与 Python 服务通讯（HTTP/WebSocket）。
- [x] 引入 FastAPI + SQLModel 后端，`backend/scripts/serve.py`、`start.sh` 已串联前后端。
- [x] 配置基础环境文件：`rss-desktop/.env.example`、`backend/.env.example` 已提供；待补充前端 `.env.local` 模板。
- [ ] 精简启动/构建脚本：补上 `pnpm dev:ui`、`pnpm dev:electron`、`pnpm dev`、`pnpm build`、`pnpm fetch-feeds` 等 npm script，并在 README 中说明。
- [ ] 打通 `python -m scripts.migrate` 与 Electron 启动脚本，方便新环境“一键运行”。

## 2. 本地数据与存储
- [x] 设计 feeds / entries / summaries schema，SQLModel + SQLite 已落地，支持去重与分页查询。
- [x] FastAPI DAO 层 + REST API 已实现，Electron 端通过 `api/client.ts` 调用。
- [x] OPML 导入导出 & 收藏统计接口可用。
- [ ] 备份/清理：补充 JSON/SQLite 备份任务与“清理旧条目”命令行入口。

## 3. Feed 采集与解析
- [x] 添加订阅 API、Feed 抓取、`feedparser` + `readability-lxml` 解析、APScheduler 定时刷新等基础能力已完成。
- [x] 抓取日志 `fetch_logs` 已写入数据库，待在 UI 暴露。
- [ ] **新增**：给 `httpx.AsyncClient` 增加自定义 `User-Agent`、`Accept`、`Referer`，解决 OUP / RSSHub 等返回 403 的问题。
- [ ] **新增**：支持为单个订阅配置自定义 Header/代理（例如 RSSHub token、Cloudflare bypass）。
- [ ] **新增**：将 `last_error`/日志内容暴露到设置面板，提示“哪些订阅解析失败/被拦截”。

## 4. 核心 UI 流程（Vue）
- [x] 三栏布局、浅/深色主题、响应式布局已对齐 `UI.md`。
- [x] Sidebar：分组、收藏目录、订阅管理、编辑/删除、OPML 操作均可用；订阅卡片 UI 已统一（描边 + 按钮分栏）。
- [x] Timeline：支持搜索、未读/收藏过滤、收藏模式、标题翻译等；虚拟滚动仍在 backlog。
- [x] Details Pane：正文、收藏/翻译/摘要入口、AI 摘要卡片均可用。
- [x] Settings Modal：主题切换、AI Key 配置等基础信息可配置。
- [ ] Timeline 虚拟滚动/分页加载，防止大量条目时卡顿。
- [ ] Feed 抓取日志与错误提示接入设置面板。

## 5. AI 辅助
- [x] 后端 GLM-4-Flash 适配、摘要/翻译 API、缓存策略均已实现。
- [x] 前端摘要卡片 + 自动翻译逻辑已落地，并支持展示翻译状态。
- [ ] 增加 AI 接口重试与速率限制提示，防止 Key 超限时静默失败。
- [ ] 允许在设置中切换不同模型/自建推理端点。

## 6. MVP 交付与体验验证
- [x] Smoke 流程（拉取 → 阅读 → 收藏/摘要）可跑通，`start.sh` 可一键启动。
- [ ] 补充快捷键支持（刷新、标为已读、打开设置）并在 UI 中提示。
- [ ] Electron Builder 打包脚本 & README “分发指南”。
- [ ] 使用手册：启动步骤、AI Key 配置、常见错误（解析失败、日志位置、缓存清理）。

## 7. 后续可选增强（Backlog）
- [ ] 多端同步/在线 API、插件体系、数据统计等高级特性。
- [ ] 离线阅读包 / 全文缓存策略。
- [ ] 更细粒度的 AI 能力（智能分组、相似文章折叠等）。
