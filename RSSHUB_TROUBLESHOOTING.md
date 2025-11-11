# RSSHub 连接问题排查和解决方案

## 🔍 诊断结果

好消息！您的RSSHub实例 `http://58.198.178.157:1200` **完全正常工作**！

### ✅ 正常工作的功能：
- 基础Web服务 ✅
- RSS路由生成 ✅ (Nature, Bilibili, GitHub等都正常)
- URL转换逻辑 ✅
- RSS内容格式 ✅

### ⚠️ 发现的问题：
1. **CORS配置**：当前只允许 `58.198.178.157:1200` 访问
2. **网络访问**：可能是内网地址，需要确认网络连通性

## 🛠️ 解决方案

### 方案1：修复RSSHub的CORS配置

如果您有RSSHub的管理权限，可以修改CORS配置：

```bash
# 进入RSSHub容器
docker exec -it <rsshub_container_id> /bin/bash

# 或者直接修改环境变量
docker run -d --name my-rsshub -p 1200:1200 \
  -e ALLOW_ORIGIN=* \
  diygod/rsshub
```

### 方案2：通过后端代理访问

由于CORS问题，我们让后端作为代理来访问RSSHub：

1. **启动后端服务**：
```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8787 --reload
```

2. **配置RSSHub URL**：
```bash
curl -X POST "http://localhost:8787/api/settings/rsshub-url" \
  -H "Content-Type: application/json" \
  -d '{"rsshub_url": "http://58.198.178.157:1200"}'
```

3. **前端通过后端访问**：
前端会通过后端API来获取RSS内容，避免了CORS问题。

### 方案3：使用代理服务器

如果网络连接有问题，可以设置代理：

```bash
# 设置环境变量
export HTTP_PROXY=http://your-proxy:port
export HTTPS_PROXY=http://your-proxy:port

# 或者在代码中配置
```

## 🧪 测试方法

### 1. 使用诊断工具
```bash
python diagnose_rsshub.py "http://58.198.178.157:1200"
```

### 2. 使用测试页面
1. 打开 `test_rsshub_frontend.html`
2. 输入RSSHub URL：`http://58.198.178.157:1200`
3. 点击"测试连接"

### 3. 直接测试RSS路由
```bash
# 测试Nature Genetics
curl "http://58.198.178.157:1200/nature/research/ng"

# 测试Bilibili动态
curl "http://58.198.178.157:1200/bilibili/user/dynamic/2267573"
```

## 🔧 常见问题解决

### 问题1：CORS跨域错误
**症状**：浏览器控制台显示CORS错误
**解决方案**：
- 修改RSSHub的CORS配置允许前端域名
- 或者通过后端代理访问（推荐）

### 问题2：网络连接失败
**症状**：无法连接到RSSHub地址
**解决方案**：
- 确认RSSHub实例正在运行
- 检查防火墙设置
- 确认网络连通性

### 问题3：RSS内容为空
**症状**：连接成功但RSS内容为空
**解决方案**：
- 检查RSSHub路由是否正确
- 确认目标网站是否有变化
- 查看RSSHub日志

## 📋 工作流程（推荐）

1. **配置RSSHub URL**：
   ```bash
   python manage_rsshub.py add "我的RSSHub" "http://58.198.178.157:1200" --priority 1 --default
   ```

2. **启动后端服务**：
   ```bash
   cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8787 --reload
   ```

3. **前端配置**：
   - 在设置界面输入RSSHub URL
   - 系统会自动通过后端访问，避免CORS问题

4. **验证功能**：
   - 添加一个RSSHub订阅源测试
   - 如：`https://rsshub.app/nature/research/ng`

## 🎯 最终确认

您的RSSHub实例是**完全正常**的，只需要：
1. 通过后端API配置URL
2. 前端通过后端访问RSSHub
3. 避免直接的跨域访问

这样就能完美工作了！