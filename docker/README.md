# Docker 部署指南 | Docker Deployment Guide

Aurora RSS Reader 支持 Docker 部署，可在 Windows 和 Linux (amd64) 上运行。

## 快速开始 | Quick Start

### 使用 Docker Compose（推荐）

```bash
# 克隆仓库
git clone https://github.com/xiongsircool/aurora-rss-reader.git
cd aurora-rss-reader

# 启动服务
docker-compose up -d

# 访问应用
# http://localhost:8080
```

### 使用 Docker 命令

```bash
# 构建镜像
docker build -t aurora-rss-reader:latest .

# 运行容器
docker run -d \
  --name aurora-rss \
  -p 8080:80 \
  -v aurora-data:/data \
  aurora-rss-reader:latest
```

## 环境变量 | Environment Variables

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_PATH` | `/data/aurora-rss.db` | 数据库文件路径 |
| `RSSHUB_BASE_URL` | `https://rsshub.app` | RSSHub 服务地址 |
| `GLM_API_KEY` | - | 智谱 AI API 密钥（可选） |
| `GLM_BASE_URL` | `https://open.bigmodel.cn/api/paas/v4/` | AI API 地址 |
| `GLM_MODEL` | `glm-4-flash` | AI 模型名称 |

## 配置 AI 功能 | Configure AI Features

编辑 `docker-compose.yml`，取消注释 AI 配置：

```yaml
environment:
  - GLM_API_KEY=your_api_key_here
  - GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4/
  - GLM_MODEL=glm-4-flash
```

## 数据持久化 | Data Persistence

数据库文件存储在 Docker volume `aurora-data` 中。

```bash
# 查看 volume
docker volume inspect aurora-data

# 备份数据
docker cp aurora-rss:/data/aurora-rss.db ./backup.db

# 恢复数据
docker cp ./backup.db aurora-rss:/data/aurora-rss.db
```

## 常用命令 | Common Commands

```bash
# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 更新镜像
docker-compose pull
docker-compose up -d
```

## 系统要求 | System Requirements

- Docker 20.10+
- Docker Compose 2.0+
- **架构**: 仅支持 `linux/amd64`（因 sqlite-vss 限制）

## 端口说明 | Ports

- `8080` - Web 界面（可在 docker-compose.yml 中修改）

## 故障排除 | Troubleshooting

### 容器无法启动
```bash
# 查看详细日志
docker-compose logs aurora-rss
```

### 数据库权限问题
```bash
# 确保 volume 权限正确
docker-compose down
docker volume rm aurora-data
docker-compose up -d
```
