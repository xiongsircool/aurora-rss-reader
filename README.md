# Aurora RSS Reader

![Banner](images/banner_sharp_aurora.png)

<p align="left">
  <img alt="App Icon" src="rss-desktop/public/icons/app-release.png" width="72" height="72" />
</p>

<!-- 技术栈：Electron · Vue 3 · FastAPI · SQLite · Pinia · Vite -->

## 简介

Aurora 是一款跨平台桌面 RSS 阅读器，提供现代的三栏阅读体验、订阅分组与收藏、OPML 导入导出等基础能力；结合可配置的大语言模型，对文章进行自动化的摘要与翻译增强，同时提供多语言界面与 RSSHub 支持。

## ✨ 功能特性

- 订阅与阅读：分组管理、三栏布局、全文预览、未读/收藏筛选、快速搜索
- OPML：一键导入/导出订阅，便于迁移与备份
- 收藏与状态：收藏、标记已读，支持按分组或订阅源查看收藏
- AI 增强：由可配置的 OpenAI 兼容大语言模型自动进行 AI 增强（摘要/翻译），可手动触发或按设置自动执行；支持标题单独翻译与长文分段翻译
- 多语言界面：内置中文、英文、日语、韩语
- RSSHub：支持自定义镜像与 URL 映射，后端代为请求以规避 CORS
- 刷新与过滤：定时刷新；按发布时间/入库时间与范围过滤时间线
- 体验优化：深/浅色主题、可拖拽布局比例、错误与进度提示，本地数据库缓存便于离线阅读

## 📸 截图

<div align="center">
  <figure style="display:inline-block;margin:0 16px 18px;text-align:center;">
    <img src="images/appimages/应用主页截图.png" alt="主页" style="width:360px;border-radius:14px;box-shadow:0 6px 30px rgba(15,17,21,.18);" />
    <figcaption>桌面端三栏布局</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 16px 18px;text-align:center;">
    <img src="images/appimages/设置长截图.png" alt="设置" style="width:360px;height:420px;object-fit:cover;object-position:top;border-radius:14px;box-shadow:0 6px 30px rgba(15,17,21,.18);" />
    <figcaption>设置（AI · 刷新 · RSSHub）</figcaption>
  </figure>
</div>

<div align="center">
  <figure style="display:inline-block;margin:0 16px 18px;text-align:center;">
    <img src="images/appimages/自动翻译和自动摘要示意图.png" alt="AI 翻译与摘要" style="width:360px;border-radius:14px;box-shadow:0 6px 30px rgba(15,17,21,.18);" />
    <figcaption>自动翻译 + 自动摘要</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 16px 18px;text-align:center;">
    <img src="images/appimages/RSSHUB订阅支持景象设置.png" alt="RSSHub 配置" style="width:360px;border-radius:14px;box-shadow:0 6px 30px rgba(15,17,21,.18);" />
    <figcaption>RSSHub 镜像与测试</figcaption>
  </figure>
</div>

<div align="center">
  <figure style="display:inline-block;margin:0 12px 16px;text-align:center;">
    <img src="images/appimages/支持自定义订阅的分类标签.png" alt="分组标签" style="width:300px;border-radius:12px;box-shadow:0 6px 30px rgba(15,17,21,.12);" />
    <figcaption>订阅分组 / 标签</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 12px 16px;text-align:center;">
    <img src="images/appimages/展示时间过滤自动刷新订阅时间设定.png" alt="时间过滤与自动刷新" style="width:300px;border-radius:12px;box-shadow:0 6px 30px rgba(15,17,21,.12);" />
    <figcaption>时间过滤与自动刷新</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 12px 16px;text-align:center;">
    <img src="images/appimages/多语言支持中文.png" alt="多语言-中文" style="width:300px;border-radius:12px;box-shadow:0 6px 30px rgba(15,17,21,.12);" />
    <figcaption>界面：中文</figcaption>
  </figure>
</div>

<div align="center">
  <figure style="display:inline-block;margin:0 10px 14px;text-align:center;">
    <img src="images/appimages/多语言支持英文.png" alt="多语言-英文" style="width:240px;border-radius:10px;box-shadow:0 4px 20px rgba(15,17,21,.1);" />
    <figcaption>界面：英文</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 10px 14px;text-align:center;">
    <img src="images/appimages/多语言支持日语.png" alt="多语言-日语" style="width:240px;border-radius:10px;box-shadow:0 4px 20px rgba(15,17,21,.1);" />
    <figcaption>界面：日语</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 10px 14px;text-align:center;">
    <img src="images/appimages/多语言支持韩文.png" alt="多语言-韩文" style="width:240px;border-radius:10px;box-shadow:0 4px 20px rgba(15,17,21,.1);" />
    <figcaption>界面：韩语</figcaption>
  </figure>
</div>

## 🧱 架构概览

- 桌面壳：Electron 主进程启动并托管后端服务（`rss-desktop/electron/main.ts`）
- 前端：Vue 3 + Vite + Pinia + vue-router + vue-i18n（`rss-desktop/src`）
- 后端：FastAPI + SQLModel + httpx + APScheduler（`backend/app`）
- 数据库存储：SQLite（默认 `backend/data/rss.sqlite`）
- 刷新任务：APScheduler 周期拉取订阅（默认 `fetch_interval_minutes`）
- AI 能力：通过 OpenAI 兼容模型执行摘要与翻译（支持长文分段并发翻译与本地缓存）

## 🚀 快速开始

### 环境要求

当前开发环境实测版本（用于参考）：

| 组件    | 实测版本 |
| ------- | -------- |
| Node.js | 22.21.1  |
| pnpm    | 10.21.0  |
| Python  | 3.12.12  |

> 提示：如使用其他版本，请确保能通过 `pnpm dev` 与 `curl http://127.0.0.1:8787/api/health` 这两个最小自检。

### 安装与运行

1) 后端依赖与环境

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt  # 或 pip install -e .
cp .env.example .env
python -m scripts.migrate
```

2) 配置后端 `.env`

`backend/.env` 示例（敏感值留空，首次可在应用内设置）：

```env
APP_ENV=development
API_HOST=127.0.0.1
API_PORT=8787
FETCH_INTERVAL_MINUTES=15

RSSHUB_BASE=https://rsshub.app

GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4/  # 默认示例，可替换任意 OpenAI 兼容 API
GLM_MODEL=glm-4-flash                          # 示例模型，按需调整
GLM_API_KEY=                                   # OpenAI 兼容 API 的密钥
```

3) 前端依赖与开发

```bash
cd ../rss-desktop
pnpm install
pnpm dev  # 并行启动前端与后端（UI: 5173, API: 8787）
```

可选：仅前端 `pnpm dev:frontend`，仅后端 `pnpm dev:backend`。

### 打包桌面应用（Electron）

```bash
cd rss-desktop
pnpm build   # 构建前端与类型检查
pnpm pack    # electron-builder 生成安装包（release/<version>/）
```

### 一键启动与自检（start.sh）

首次使用，建议通过仓库根目录的 `start.sh` 完成环境准备与快速联调：

1) 前置条件

- 已安装 `Node >= 18`、`pnpm`、`Python >= 3.9`
- 复制后端环境：`cp backend/.env.example backend/.env`，如需使用 AI，请在 `.env` 中填写 `GLM_API_KEY`

2) 运行

```bash
chmod +x start.sh
./start.sh
```

脚本会：
- 创建并使用 `backend/.venv`，安装后端依赖
- 安装前端依赖 `rss-desktop/node_modules`
- 初始化数据库 `backend/data/rss.sqlite`
- 启动前端开发服务器（Electron 在开发模式会自动托管后端）

3) 快速自检

- 浏览器访问 UI：`http://localhost:5173`
- 健康检查 API：
  ```bash
  curl http://127.0.0.1:8787/api/health
  # => {"status":"ok"}
  ```
  若失败，请检查 `.env`、端口占用与控制台输出。

## ⚙️ 配置与特性

- AI 配置：在设置中填写 OpenAI 兼容 API 的 Base URL、Model 与 API Key；可独立开启「自动摘要」「自动翻译」「标题自动翻译」，并选择翻译目标语言
- RSSHub：在设置中配置镜像地址并测试连通性，可通过后端 API `/api/settings/rsshub-url` 同步更新
- 时间过滤：支持按 `published_at` 或 `inserted_at` 且提供 1d/7d/30d/90d/180d/365d/all 预设范围
- OPML：从左侧工具区导入或导出 `.opml/.xml`
- 布局：拖拽分隔条调整侧栏/详情比例，内置深/浅色主题记忆

## 🔌 API（选读）

- 订阅：`GET/POST/PATCH/DELETE /api/feeds`，`POST /api/feeds/{id}/refresh`
- 文章：`GET /api/entries`，`PATCH /api/entries/{id}`；收藏相关接口见 `backend/app/api/routes/entries.py`
- OPML：`GET /api/opml/export`，`POST /api/opml/import`
- AI：`POST /api/ai/summary`，`POST /api/ai/translate`，`POST /api/ai/translate-title`
- 设置：`GET/PATCH /api/settings`，AI 配置见 `backend/app/api/routes/ai.py`

## 🔒 安全与隐私

- 本地 `.env` 保存 API Key，不会提交到仓库（已在 `.gitignore`）
- 数据库存放于本地 `backend/data/`，摘要与翻译结果会缓存以减少开销
- 可使用 `./tools/scan-secrets.sh` 扫描潜在敏感信息后再提交

## 🛡️ 知识产权与溯源

- `build_signature.json`：记录作者 `xiongxiangyi <1666526339@qq.com>`、生成时间、commit 与 SHA-256 指纹，请在重新发布或自动化构建时同步更新。
- 关键视觉素材（如 `images/banner_sharp_aurora.png`）内嵌 `Aurora-Author` / `Aurora-Provenance` PNG 文本块作为数字水印，用于证明原创性，请勿移除。

## 🗂️ 项目结构

```
RSSpage/
├─ backend/
│  ├─ app/
│  │  ├─ api/routes/           # FastAPI 路由
│  │  ├─ core/                  # 配置
│  │  ├─ db/                    # SQLModel 与迁移脚本
│  │  ├─ services/              # 抓取、AI、RSSHub 管理
│  │  └─ schemas/               # Pydantic 模型
│  ├─ scripts/                  # dev server / 迁移
│  └─ data/                     # SQLite 数据
└─ rss-desktop/
   ├─ src/                      # Vue 应用
   └─ electron/                 # Electron 主进程
```

## 📚 相关文档

- 后端说明：`backend/README.md`

## 🙏 致谢

- FastAPI、Vue 3、Electron、SQLModel、httpx、APScheduler
- OpenAI 兼容模型服务（例如 GLM-4 系列 / open.bigmodel.cn）

如需英文版 README 或将截图改为更轻量的拼图布局，请告诉我。
