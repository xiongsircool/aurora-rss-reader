# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

RSS READER 是一个基于 Python FastAPI + Vue 3 + Electron 的本地 RSS 阅读器，支持 AI 摘要和翻译功能。项目分为前后端两部分：

- **后端**: FastAPI 服务，负责 RSS 抓取、存储、AI 集成
- **前端**: Vue 3 + Electron 桌面应用，提供用户界面

## 常用开发命令

### 启动项目
```bash
# 在 rss-desktop 目录下并行启动前后端
pnpm dev

# 仅启动前端
pnpm dev:frontend

# 仅启动后端
pnpm dev:backend
```

### 后端管理
```bash
# 进入后端目录
cd backend

# 安装依赖
pip install -e .

# 数据库迁移
python -m scripts.migrate

# 启动后端服务（开发模式）
python -m scripts.serve

# 代码检查
ruff check .
ruff format .
mypy .
```

### 前端管理
```bash
# 进入前端目录
cd rss-desktop

# 安装依赖
pnpm install

# 类型检查
pnpm typecheck

# 构建
pnpm build
```

## 核心架构

### 后端架构
- **API 路由**: `backend/app/api/routes/` - RESTful API 端点
  - `feeds.py`: RSS 源管理
  - `entries.py`: 文章管理
  - `ai.py`: AI 摘要/翻译
  - `opml.py`: OPML 导入导出
  - `settings.py`: 用户设置
  - `rsshub.py`: RSSHub 配置

- **数据模型**: `backend/app/db/models.py` - 核心数据表结构
  - `Feed`: RSS 源信息
  - `Entry`: 文章条目
  - `UserSettings`: 用户配置

- **业务逻辑**: `backend/app/services/`
  - `fetcher.py`: RSS 抓取器
  - `ai.py`: AI 服务代理（GLM-4-Flash）
  - `rsshub_manager.py`: RSSHub 配置管理

### 前端架构
- **状态管理**: `rss-desktop/src/stores/` - Pinia 状态
  - `feedStore.ts`: RSS 源和文章状态
  - `settingsStore.ts`: 用户设置状态
  - `aiStore.ts`: AI 功能状态

- **API 客户端**: `rss-desktop/src/api/client.ts` - Axios HTTP 客户端
- **页面组件**: `rss-desktop/src/views/` - Vue 单文件组件

## 关键配置

### 环境配置
- 后端配置: `backend/.env` - GLM API Key 必需
- 前端代理: `rss-desktop/vite.config.ts` - `/api` 路径代理到后端

### 数据库
- SQLite 数据库: `backend/data/rss.sqlite`
- 自动迁移: `backend/scripts/migrate.py`
- 新增模型后需要创建迁移脚本

### AI 服务集成
- 使用 GLM-4-Flash 模型进行摘要和翻译
- 支持本地缓存节省 API 调用
- 配置环境变量: `GLM_API_KEY`

## 开发注意事项

### RSS 源管理
- RSS 源支持分组管理
- 自动抓取间隔可配置（默认 15 分钟）
- 支持手动刷新单源或全量刷新

### 数据库模式更新
1. 修改 `backend/app/db/models.py` 添加新模型/字段
2. 创建迁移脚本更新数据库结构
3. 使用 `python -m scripts.migrate` 应用迁移

### 前端状态管理
- 使用 Pinia 进行状态管理
- 支持本地缓存 AI 结果
- 响应式数据流设计

### CORS 配置
- 开发环境允许所有 localhost 端口
- 生产环境需要配置允许的源列表