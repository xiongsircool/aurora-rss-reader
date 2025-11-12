# RSSHub URL 配置使用指南

## 🎯 功能概述

现在您可以在RSS阅读器中配置自己的RSSHub实例地址，当遇到RSSHub相关的订阅源时，系统会自动使用您配置的RSSHub地址。

## 📝 配置步骤

### 1. 启动后端服务

```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8787 --reload
```

### 2. 配置RSSHub URL

#### 方法一：使用命令行工具

```bash
# 设置您的RSSHub地址
python manage_rsshub.py add "我的RSSHub" "http://localhost:1200" --priority 1 --default

# 查看当前配置
python manage_rsshub.py list
```

#### 方法二：使用API接口

```bash
# 更新RSSHub URL
curl -X POST "http://localhost:8787/api/settings/rsshub-url" \
  -H "Content-Type: application/json" \
  -d '{"rsshub_url": "http://localhost:1200"}'

# 获取当前RSSHub URL
curl "http://localhost:8787/api/settings/rsshub-url"
```

#### 方法三：使用前端界面

1. 启动前端应用
2. 打开设置界面
3. 在"RSSHub 配置"部分输入您的RSSHub地址
4. 点击"测试RSSHub连接"验证可用性
5. 点击"保存"保存设置

### 3. 测试前端界面

打开提供的测试页面：
```bash
# 在浏览器中打开
open test_rsshub_frontend.html
```

## 🔧 RSSHub部署

如果您还没有自己的RSSHub实例，可以通过以下方式部署：

### Docker部署（推荐）

```bash
# 拉取RSSHub镜像
docker pull diygod/rsshub

# 启动RSSHub实例（端口1200）
docker run -d --name my-rsshub -p 1200:1200 diygod/rsshub

# 您的RSSHub地址就是：http://localhost:1200
```

### Docker Compose部署

```yaml
# docker-compose.yml
version: '3'
services:
  rsshub:
    image: diygod/rsshub
    restart: always
    ports:
      - "1200:1200"
    environment:
      NODE_ENV: production
      CACHE_TYPE: redis
      REDIS_URL: redis://redis:6379/
    depends_on:
      - redis

  redis:
    image: redis:alpine
    restart: always
```

### Vercel部署

1. 访问 https://rsshub.app/deploy
2. 点击 "Deploy to Vercel"
3. 部署到您的Vercel账户

## 📋 使用示例

配置完成后，当您的RSS订阅源中包含RSSHub链接时：

```
原始链接：https://rsshub.app/nature/research/ng
转换后： http://localhost:1200/nature/research/ng

原始链接：https://rsshub.app/bilibili/user/dynamic/2267573
转换后： http://localhost:1200/bilibili/user/dynamic/2267573
```

## 🔍 测试验证

### 1. 测试RSSHub连接

```bash
# 使用测试工具
python test_rsshub_config.py

# 或直接测试您的RSSHub
curl "http://localhost:1200/api/it之家/news"
```

### 2. 测试URL转换

```python
# 运行转换测试
python test_rsshub_config.py
```

### 3. 测试RSS获取

```bash
# 测试特定的RSS源
python test_feeds.py "https://rsshub.app/nature/research/ng"
```

## 🚀 功能特性

1. **简单配置**：只需输入RSSHub URL即可
2. **自动转换**：系统自动将RSSHub链接转换为您的实例地址
3. **连接测试**：可测试RSSHub实例的可用性
4. **持久化存储**：配置保存在数据库中
5. **前端界面**：提供友好的Web界面配置

## 📝 API接口

- `GET /api/settings/rsshub-url` - 获取当前RSSHub URL
- `POST /api/settings/rsshub-url` - 更新RSSHub URL
- `GET /api/settings` - 获取所有用户设置
- `PATCH /api/settings` - 更新用户设置

## 🐛 故障排除

### RSSHub连接失败

1. **检查网络**：确保RSSHub实例可以访问
2. **检查端口**：确认端口配置正确
3. **检查防火墙**：确保防火墙允许连接
4. **检查部署**：确认RSSHub实例正常运行

### URL转换不生效

1. **检查配置**：确认RSSHub URL已正确保存
2. **检查链接格式**：确认链接包含RSSHub域名
3. **重启应用**：尝试重启RSS获取服务

### 前端无法连接后端

1. **检查端口**：确认后端运行在8787端口
2. **检查CORS**：确认后端允许前端域名访问
3. **检查网络**：确认网络连接正常

## 🎉 完成！

配置完成后，您的RSS阅读器将优先使用您自己的RSSHub实例，提供更稳定、更快速的RSS订阅服务！
