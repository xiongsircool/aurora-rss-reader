# RSS 管理工具 · Todo List（Vue 本地 MVP）

> 目标：以 Vue 3 + Vite 打造一个“本地运行、单应用”最小可用版本，先完成阅读体验与基础 AI 辅助，再考虑扩展。

## 1. 技术栈与脚手架
- [x] 初始化 `Vue 3 + Vite + TypeScript` 前端（Pinia + Vue Router）。`rss-desktop/` 已通过 `create-electron-vite` 搭建。
- [x] 使用 `Electron + Vite` 作为桌面容器，Electron 主进程负责窗口管理与与 Python 侧 IPC（可用 `child_process` 启动 Python 服务或通过 WebSocket/HTTP 通信）。
- [x] 引入 Python 后端（FastAPI + Uvicorn），主要负责 SQLite 访问、Feed 抓取、AI 调用；`backend/` 已包含 `scripts/serve.py` 开发入口。
- [ ] 配置环境变量：前端 `.env.local`（Electron 渠道变量）+ Python `.env`（GLM Key、SQLite 路径、RSSHub URL）；确保密钥仅保留在本地文件。
- [ ] 内置脚本：`pnpm dev:ui`、`pnpm dev:electron`、`pnpm dev`（并行启动 Electron + Python），`pnpm build`（打包），`python -m scripts.migrate`（初始化数据库）。

- [ ] 内置脚本：`pnpm fetch-feeds`（手动触发拉取）、`pnpm migrate`（初始化数据库或 IndexedDB store）。

## 2. 本地数据与存储
- [ ] 设计 feeds / entries / translations / summaries schema，使用 Python + SQLModel/SQLAlchemy + Alembic 生成迁移；SQLite 文件默认存放在 `~/Library/Application Support/RSSMVP/data.sqlite`。
- [ ] 在 FastAPI 中实现 DAO 层（批量插入、`guid + feed_id` 去重、分页查询），并提供 REST/WebSocket API 给 Electron 前端调用。
- [ ] 实现最小备份/导入：Python 提供 OPML 导出/导入接口以及 JSON 备份任务；暴露“清理旧条目”命令。

## 3. Feed 采集与解析
- [ ] 在 Python 中实现添加订阅 API：支持直接 RSS 链接 + 网页 URL 自动发现（requests + BeautifulSoup 提取 `<link>`；补充常见路径猜测）。
- [ ] 使用 `feedparser` + `readability-lxml`（可选）解析 RSS/Atom/JSON Feed，统一输出结构返回给数据库层。
- [ ] 设计后台计划任务（APScheduler 或手动 cron），支持“手动刷新”和定时拉取；完成写库与状态更新。
- [ ] 将抓取日志写入 SQLite `fetch_logs` 表，并提供 API 供设置面板读取。

## 4. 核心 UI 流程（Vue）
- [ ] 在 Electron 渲染进程实现三栏布局（Sidebar / Timeline / Details+AI），遵循 `UI.md` 的尺寸与交互；通过 `@electron/remote` 或自定义 IPC 获取系统主题，支持浅/深色切换。
- [ ] Sidebar：列出分组/订阅、添加订阅入口、快捷筛选（全部/未读/收藏）；操作通过 REST/WebSocket 调用 Python 服务。
- [ ] Timeline：虚拟滚动或懒加载，支持未读状态点、时间戳、收藏按钮、批量“标为已读”。
- [ ] Details Pane：展示全文、阅读进度、收藏/标记按钮；支持解析失败的 fallback。
- [ ] Settings & Import Drawer：主题切换、RSSHub/代理配置、OPML 导入导出、抓取日志面板。

## 5. AI 辅助（可选但建议）
- [ ] 在 Python 层实现 GLM-4-Flash 适配器（Base URL: `https://open.bigmodel.cn/api/paas/v4/`, Model: `glm-4-flash`, Key: `db8f92ecc62a46e8982d562075ac3511.DveQeGNFR07A2IkY` 仅写入 `.env`），统一提供摘要/翻译接口。
- [ ] 前端展示 AI Summary 卡片：状态流转（待生成/生成中/成功/失败），支持手动触发与结果缓存到本地表。
- [ ] 基于语言偏好提供“自动翻译”开关，生成后回填到详情视图。

## 6. MVP 交付与体验验证
- [ ] 记录关键快捷键（刷新、标为已读、打开设置），并在 UI 中可视化提示。
- [ ] 编写最小 Smoke Test：拉取示例 RSS → 展示时间线 → 打开详情 → 生成摘要（调用 Python API）。
- [ ] 打包方案：使用 Electron Builder 生成 macOS/Windows 安装包，包含 Python 可执行或依赖说明；同时提供 `dev` 启动脚本。
- [ ] 整理使用手册：启动步骤、AI Key 配置、常见问题（解析失败、日志位置、缓存清理）。

## 7. 后续可选增强（留作 Backlog）
- [ ] 多端同步/远程 API、插件体系、数据可视化等高级特性等 MVP 稳定后再规划。
