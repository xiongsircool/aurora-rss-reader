# 构建指南

本文档说明如何使用 GitHub Actions 自动构建全平台安装包。

## 📦 支持的平台

### macOS
- **Universal Binary** (同时支持 Intel 和 Apple Silicon)
- 格式: DMG + ZIP
- 架构: x64 + arm64 (通用二进制)

### Windows
- 格式: NSIS 安装包 + Portable 便携版
- 架构: x64 + ARM64

### Linux
- 格式: AppImage + DEB
- 架构: x64 + ARM64

---

## 🚀 使用 GitHub Actions 自动构建

### 方法 1: 通过 Git Tag 触发（推荐）

这是发布新版本的标准方式：

```bash
# 1. 更新版本号
cd rss-desktop
npm version patch  # 或 minor, major

# 2. 创建并推送 tag
git add .
git commit -m "chore: bump version to v0.1.4"
git tag v0.1.4
git push origin main --tags

# 3. GitHub Actions 会自动开始构建
# 访问 https://github.com/你的用户名/aurora-rss-reader/actions 查看进度
```

构建完成后，会自动创建 GitHub Release 并上传所有安装包。

### 方法 2: 手动触发构建

如果不想创建 Release，只想测试构建：

1. 访问 GitHub 仓库的 Actions 页面
2. 选择 "Build and Release" 工作流
3. 点击 "Run workflow" 按钮
4. 选择分支（通常是 main）
5. 点击 "Run workflow" 确认

构建产物会保存 7 天，可以在 Actions 页面下载。

---

## 🛠️ 本地构建

如果需要在本地构建（不推荐，建议使用 GitHub Actions）：

### 构建所有平台（仅限 macOS）

```bash
# 在项目根目录执行
./build-release-app.sh
```

### 构建单个平台

```bash
cd rss-desktop

# macOS Universal Binary
pnpm prepare:backend && pnpm build && pnpm exec electron-builder --mac --universal

# Windows (需要在 Windows 或使用 Wine)
pnpm prepare:backend && pnpm build && pnpm exec electron-builder --win --x64 --arm64

# Linux
pnpm prepare:backend && pnpm build && pnpm exec electron-builder --linux --x64 --arm64
```

---

## 📊 构建产物说明

构建完成后，会生成以下文件：

### macOS
- `AuroraRSSReader-Mac-0.1.3.dmg` - 磁盘镜像安装包（推荐）
- `AuroraRSSReader-Mac-0.1.3.zip` - 压缩包版本

### Windows
- `AuroraRSSReader-Windows-0.1.3-x64-Setup.exe` - x64 安装程序
- `AuroraRSSReader-Windows-0.1.3-arm64-Setup.exe` - ARM64 安装程序
- `AuroraRSSReader-Windows-0.1.3-x64-Portable.exe` - x64 便携版
- `AuroraRSSReader-Windows-0.1.3-arm64-Portable.exe` - ARM64 便携版

### Linux
- `AuroraRSSReader-Linux-0.1.3-x64.AppImage` - x64 AppImage（推荐）
- `AuroraRSSReader-Linux-0.1.3-arm64.AppImage` - ARM64 AppImage
- `AuroraRSSReader-Linux-0.1.3-x64.deb` - x64 Debian 包
- `AuroraRSSReader-Linux-0.1.3-arm64.deb` - ARM64 Debian 包

---

## 🔧 构建配置说明

### electron-builder 配置

配置文件位于 [rss-desktop/electron-builder.json5](../rss-desktop/electron-builder.json5)

关键配置：
- `mac.target.arch: ["universal"]` - macOS 通用二进制
- `win.target.arch: ["x64", "arm64"]` - Windows 多架构支持
- `linux.target.arch: ["x64", "arm64"]` - Linux 多架构支持

### GitHub Actions 工作流

配置文件位于 [.github/workflows/build-release.yml](../.github/workflows/build-release.yml)

工作流包含 4 个任务：
1. `build-macos` - 在 macOS 上构建 Universal Binary
2. `build-windows` - 在 Windows 上构建 x64 + ARM64
3. `build-linux` - 在 Ubuntu 上构建 x64 + ARM64
4. `create-release` - 创建 GitHub Release 并上传所有产物

---

## ❓ 常见问题

### Q: 为什么 macOS 使用 Universal Binary？

A: Universal Binary 让用户无需选择架构，一个安装包同时支持 Intel 和 Apple Silicon Mac，提供最佳用户体验。

### Q: 构建失败怎么办？

A: 检查以下几点：
1. 确保后端已编译（`backend-node/dist` 目录存在）
2. 检查 `node_modules` 是否完整安装
3. 查看 GitHub Actions 日志获取详细错误信息

### Q: 如何减少安装包体积？

A: 已经实现了以下优化：
- 使用 `compression: "maximum"` 最大压缩
- 过滤掉 source map 文件
- 使用 `tools/prepare-backend-node.mjs` 准备 Electron 打包所需的后端资源

### Q: 支持哪些 CPU 架构？

A:
- **macOS**: Universal Binary (Intel x64 + Apple Silicon arm64)
- **Windows**: x64 + ARM64
- **Linux**: x64 + ARM64

### Q: 构建需要多长时间？

A: GitHub Actions 并行构建，总耗时约 15-20 分钟：
- macOS: ~8-10 分钟
- Windows: ~6-8 分钟
- Linux: ~5-7 分钟

---

## 📝 发布检查清单

发布新版本前，请确认：

- [ ] 更新了版本号（`rss-desktop/package.json`）
- [ ] 更新了 CHANGELOG（如果有）
- [ ] 测试了主要功能
- [ ] 提交了所有代码更改
- [ ] 创建并推送了 Git tag
- [ ] 等待 GitHub Actions 构建完成
- [ ] 验证 Release 页面的安装包

---

## 🔗 相关链接

- [electron-builder 文档](https://www.electron.build/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [项目主页](https://github.com/xiongsircool/aurora-rss-reader)
