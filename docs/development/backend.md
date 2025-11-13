# 后端开发文档

Aurora RSS Reader 的后端服务，基于 FastAPI + SQLite 构建RSS订阅管理和AI增强功能。

## 🚀 快速启动

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python -m scripts.serve
```

## 🏗️ 架构设计

### 目录结构
```
backend/
├── app/
│   ├── api/routes/     # FastAPI 路由
│   ├── core/          # 配置管理
│   ├── db/            # 数据库模型
│   ├── services/      # 业务服务
│   └── schemas/       # 数据模型
├── scripts/           # 工具脚本
└── .venv/            # Python 虚拟环境
```

### 主要模块

#### 📡 API 路由 (`app/api/routes/`)
- `feeds.py` - RSS 订阅源管理
- `entries.py` - 文章内容管理
- `ai.py` - AI 增强功能
- `settings.py` - 系统设置
- `opml.py` - OPML 导入导出

#### 💾 数据库 (`app/db/`)
- 基于 SQLModel 和 SQLite
- 自动迁移支持
- 本地数据存储

#### ⚙️ 核心服务 (`app/services/`)
- `fetcher.py` - RSS 内容抓取
- `ai.py` - AI 翻译和摘要
- `rsshub_manager.py` - RSSHub 管理

## 🔧 开发配置

### 环境变量 (`.env`)
```env
APP_ENV=development
API_HOST=127.0.0.1
API_PORT=15432

# RSSHub 配置
RSSHUB_BASE=https://rsshub.app

# AI 配置
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4/
GLM_MODEL=glm-4-flash
GLM_API_KEY=your_api_key_here
```

### 数据库初始化
```bash
python -m scripts.migrate
```

## 📡 API 接口

默认运行在 `http://127.0.0.1:15432`

### 主要端点
- `GET/POST/PATCH/DELETE /api/feeds` - RSS 订阅管理
- `GET /api/entries` - 文章列表
- `POST /api/ai/summary` - 生成摘要
- `POST /api/ai/translate` - 翻译内容
- `GET/POST /api/settings` - 系统设置
- `GET /api/health` - 健康检查

### 数据格式
所有 API 返回 JSON 格式数据，遵循 RESTful 设计原则。

## 🧪 开发工具

### 启动开发服务器
```bash
python -m scripts.serve
```

### 数据库迁移
```bash
python -m scripts.migrate
```

### 测试接口
```bash
curl http://127.0.0.1:15432/health
```

## 🔗 与前端通信

后端通过 HTTP API 与 Electron 前端通信：
- 前端通过 axios 调用 API
- 支持 CORS 配置
- 实时数据通过 WebSocket 传输
