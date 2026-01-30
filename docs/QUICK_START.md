# 快速开始 - GitHub Actions 自动打包

## 🎯 最简单的使用方式

### 发布新版本（推荐）

```bash
# 1. 更新版本号
cd rss-desktop
npm version patch  # 0.1.3 -> 0.1.4

# 2. 提交并推送 tag
git add .
git commit -m "chore: release v0.1.4"
git push origin main
git push origin --tags

# 3. 等待构建完成（15-20分钟）
# 访问 https://github.com/你的用户名/aurora-rss-reader/releases
```

就这么简单！GitHub Actions 会自动：
- ✅ 构建 macOS Universal Binary (Intel + Apple Silicon)
- ✅ 构建 Windows x64 + ARM64 安装包
- ✅ 构建 Linux x64 + ARM64 安装包
- ✅ 创建 GitHub Release
- ✅ 上传所有安装包

---

## 📦 生成的安装包

### macOS (1个文件)
- `AuroraRSSReader-Mac-0.1.4.dmg` - 通用二进制（同时支持 Intel 和 M1/M2/M3）

### Windows (4个文件)
- `AuroraRSSReader-Windows-0.1.4-x64-Setup.exe`
- `AuroraRSSReader-Windows-0.1.4-arm64-Setup.exe`
- `AuroraRSSReader-Windows-0.1.4-x64-Portable.exe`
- `AuroraRSSReader-Windows-0.1.4-arm64-Portable.exe`

### Linux (4个文件)
- `AuroraRSSReader-Linux-0.1.4-x64.AppImage`
- `AuroraRSSReader-Linux-0.1.4-arm64.AppImage`
- `AuroraRSSReader-Linux-0.1.4-x64.deb`
- `AuroraRSSReader-Linux-0.1.4-arm64.deb`

---

## 🔧 手动触发构建（测试用）

如果只想测试构建，不想发布：

1. 访问 GitHub 仓库 → Actions 标签页
2. 选择 "Build and Release" 工作流
3. 点击 "Run workflow" → 选择分支 → 确认

构建产物会保存 7 天，可以在 Actions 页面下载。

---

## 📚 详细文档

查看 [BUILD_GUIDE.md](./BUILD_GUIDE.md) 了解更多信息。
