# RSSHub 配置指南

## 🎯 什么是 RSSHub

RSSHub 是一个开源的 RSS 生成器，可以为各种网站生成 RSS 订阅源。Aurora RSS Reader 支持自定义 RSSHub 实例，让你可以使用自己的 RSSHub 服务。

## 📝 配置步骤

### 1. 获取 RSSHub 实例地址

常用的 RSSHub 实例：
- 官方实例：`https://rsshub.app`
- 自建实例：`http://localhost:1200`
- 其他公共实例

### 2. 在应用中配置

#### 通过设置界面
1. 打开 Aurora RSS Reader
2. 点击设置按钮
3. 在 RSSHub 配置区域输入你的实例地址
4. 点击测试连接确保可用
5. 保存设置

#### 通过配置文件
编辑 `backend/.env` 文件：
```env
RSSHUB_BASE=https://your-rsshub-instance.com
```

### 3. 重启服务

如果修改了配置文件，需要重启后端服务：
```bash
# 停止当前服务后重新启动
./start.sh
```

## 🔍 常用 RSSHub 路由

配置完成后，你可以使用各种 RSSHub 路由：

### 社交媒体
- 微博用户：`/weibo/user/:uid`
- B站用户：`/bilibili/user/videoupid/:uid`
- 知乎用户：`/zhihu/people/:username`

### 新闻资讯
- GitHub 趋势：`/github/trending/:since/:language`
- V2EX 热门：`/v2ex/hot/:type`
- 少数派最新：`/sspai/latest`

### 其他资源
- 微信公众号：`/wechat/mp/:acctid`
- 播客节目：`/podcast/itunes/:id`

## 🛠️ 自建 RSSHub

如果你想要搭建自己的 RSSHub 实例：

### Docker 部署
```bash
docker run -d --name rsshub -p 1200:1200 diygod/rsshub
```

### 详细文档
- [RSSHub 官方文档](https://docs.rsshub.app/)
- [部署教程](https://docs.rsshub.app/zh/zh-cn/deploy/)

## ⚠️ 注意事项

1. **网络访问**：确保你的 RSSHub 实例能被访问到
2. **CORS 配置**：如果使用自建实例，需要正确配置 CORS
3. **性能考虑**：公共实例可能有访问限制，自建实例更稳定
4. **更新频率**：RSSHub 会定期更新，建议保持实例版本较新

## 🔧 故障排除

如果遇到 RSSHub 相关问题，请参考 [故障排除指南](./RSSHUB_TROUBLESHOOTING.md)。