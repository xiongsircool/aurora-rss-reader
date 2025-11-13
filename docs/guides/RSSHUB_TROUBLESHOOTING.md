# RSSHub 故障排除

## 🔍 常见问题及解决方案

### 1. 连接失败

#### 症状
- 无法连接到 RSSHub 实例
- 连接超时
- 连接被拒绝

#### 解决方案
```bash
# 检查 RSSHub 是否运行
curl http://your-rsshub-instance.com/api/it之家/news

# 检查网络连通性
ping your-rsshub-instance.com

# 检查端口是否开放
telnet your-rsshub-instance.com 80
```

### 2. CORS 错误

#### 症状
- 浏览器控制台显示跨域错误
- 前端无法直接访问 RSSHub

#### 解决方案
**方法一：配置 RSSHub CORS**
```bash
# 如果使用 Docker，添加环境变量
docker run -d --name rsshub -p 1200:1200 \
  -e ALLOW_ORIGIN=* \
  diygod/rsshub
```

**方法二：使用后端代理（推荐）**
Aurora RSS Reader 自动通过后端代理访问 RSSHub，避免 CORS 问题。

### 3. RSS 内容为空

#### 症状
- 连接成功但返回空内容
- RSS 格式错误

#### 解决方案
```bash
# 测试具体路由
curl "http://your-rsshub-instance.com/nature/research/ng"

# 检查路由是否正确
# 查看官方文档：https://docs.rsshub.app/
```

### 4. 性能问题

#### 症状
- RSS 加载缓慢
- 频繁超时

#### 解决方案
- 使用自建 RSSHub 实例而非公共实例
- 配置缓存（Redis）
- 检查服务器资源

## 🛠️ 诊断步骤

### 步骤 1：基础连接测试
```bash
# 测试基础连接
curl -I http://your-rsshub-instance.com

# 预期返回：HTTP/1.1 200 OK
```

### 步骤 2：RSS 内容测试
```bash
# 测试具体 RSS 路由
curl "http://your-rsshub-instance.com/github/trending"

# 检查返回内容是否为有效 RSS
```

### 步骤 3：应用内测试
1. 打开 Aurora RSS Reader
2. 进入设置 → RSSHub 配置
3. 输入你的 RSSHub 地址
4. 点击"测试连接"
5. 查看测试结果

## 📋 配置验证

### 检查配置文件
```bash
# 检查后端配置
cat backend/.env | grep RSSHUB

# 应该看到类似：
# RSSHUB_BASE=https://your-rsshub-instance.com
```

### 检查应用设置
在应用中查看当前 RSSHub 配置，确保地址正确。

## 🆘 获取帮助

如果以上方法都无法解决问题：

1. **查看日志**：检查 RSSHub 和 Aurora 后端日志
2. **社区求助**：[RSSHub GitHub Issues](https://github.com/DIYgod/RSSHub/issues)
3. **查阅文档**：[RSSHub 官方文档](https://docs.rsshub.app/)

## 📝 常用 RSSHub 实例

| 实例 | 地址 | 状态 |
|------|------|------|
| 官方实例 | https://rsshub.app | 稳定但有限制 |
| 自建实例 | http://localhost:1200 | 需要自己维护 |
| 其他公共实例 | https://rsshub.rssforever.com | 可能有变化 |

## ⚡ 性能优化建议

1. **使用自建实例**：避免公共实例的限制
2. **配置缓存**：使用 Redis 缓存提高响应速度
3. **定期更新**：保持 RSSHub 版本最新
4. **监控资源**：确保服务器资源充足