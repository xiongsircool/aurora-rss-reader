# 🚀 自动更新快速开始指南

## 30 秒快速部署

### 1. 已完成的集成 ✅

所有代码已集成完毕，无需额外配置！自动更新功能已经可以使用了。

### 2. 发布第一个支持自动更新的版本

```bash
# 进入项目目录
cd /Users/Apple/Documents/githubs/aurora-rss-reader/rss-desktop

# 更新版本号（当前是 0.1.4，升级到 0.1.5）
npm version patch

# 推送到 GitHub（包含 tag）
git push origin main --tags

# 等待 GitHub Actions 自动构建和发布 ✅
```

### 3. 验证发布

1. 访问 [GitHub Releases](https://github.com/xiongsircool/aurora-rss-reader/releases)
2. 确认新版本发布成功
3. 检查是否包含以下文件：
   - ✅ `AuroraRSSReader-Mac-0.1.5.dmg`
   - ✅ `AuroraRSSReader-Mac-0.1.5.zip`
   - ✅ `latest-mac.yml` 👈 **重要！**
   - ✅ Windows 和 Linux 的相应文件

### 4. 用户端测试

```bash
# 安装旧版本（0.1.4）
# 打开应用
# 等待 5 秒，应该会弹出更新提示 ✅
```

---

## 📋 详细步骤说明

### 步骤 1: 准备发布新版本

#### 更新版本号
```bash
cd rss-desktop

# 选择更新类型
npm version patch   # 0.1.4 → 0.1.5（bug 修复）
npm version minor   # 0.1.5 → 0.2.0（新功能）
npm version major   # 0.2.0 → 1.0.0（重大变更）
```

这会自动：
- ✅ 修改 `package.json` 的 `version` 字段
- ✅ 创建一个 Git commit
- ✅ 创建一个 Git tag（如 `v0.1.5`）

#### （可选）更新 CHANGELOG
```bash
# 编辑 CHANGELOG.md
vim CHANGELOG.md
```

添加新版本的更新内容：
```markdown
## [0.1.5] - 2026-01-27

### Added
- 新增自动更新功能
- 支持后台下载更新包

### Fixed
- 修复 XXX bug

### Changed
- 改进 XXX 用户体验
```

### 步骤 2: 推送到 GitHub

```bash
# 推送代码和 tag
git push origin main --tags
```

### 步骤 3: 等待自动构建

GitHub Actions 会自动：

1. **触发构建**（检测到 `v*` tag）
2. **并行构建三个平台**：
   - macOS (Universal)
   - Windows (x64 + ARM64)
   - Linux (x64 + ARM64)
3. **生成更新清单文件**：
   - `latest-mac.yml`
   - `latest.yml` (Windows)
   - `latest-linux.yml`
4. **创建 GitHub Release**
5. **上传所有文件**

查看构建进度：
- [GitHub Actions](https://github.com/xiongsircool/aurora-rss-reader/actions)

### 步骤 4: 验证发布

访问 [Releases 页面](https://github.com/xiongsircool/aurora-rss-reader/releases) 检查：

#### macOS 文件
- [x] `AuroraRSSReader-Mac-0.1.5.dmg` (安装包)
- [x] `AuroraRSSReader-Mac-0.1.5.zip` (差分更新用)
- [x] `latest-mac.yml` ⚠️ **必须有！**

#### Windows 文件
- [x] `AuroraRSSReader-Windows-0.1.5-x64-Setup.exe`
- [x] `AuroraRSSReader-Windows-0.1.5-arm64-Setup.exe`
- [x] `latest.yml` ⚠️ **必须有！**

#### Linux 文件
- [x] `AuroraRSSReader-Linux-0.1.5-x64.AppImage`
- [x] `AuroraRSSReader-Linux-0.1.5-arm64.AppImage`
- [x] `latest-linux.yml` ⚠️ **必须有！**

### 步骤 5: 用户测试

#### 模拟旧版本用户

```bash
# 1. 安装旧版本（0.1.4）
# 下载: https://github.com/xiongsircool/aurora-rss-reader/releases/tag/v0.1.4

# 2. 打开应用

# 3. 等待 5 秒，观察是否弹出更新提示

# 4. 点击"立即下载"

# 5. 观察下载进度

# 6. 下载完成后点击"立即重启"

# 7. 应用重启，版本号应该是 0.1.5 ✅
```

#### 查看日志
```bash
# macOS
tail -f ~/Library/Application\ Support/Aurora\ RSS\ Reader/desktop_startup.log

# 应该看到类似内容:
# [2026-01-27] 🔄 初始化自动更新器
# [2026-01-27] 🔍 开始检查更新...
# [2026-01-27] ✨ 发现新版本: 0.1.5
```

---

## 🎯 关键检查点

### ✅ 发布前检查
- [ ] 版本号已更新（`package.json`）
- [ ] Git tag 已创建
- [ ] 代码已推送到 GitHub
- [ ] GitHub Actions 工作流已触发

### ✅ 发布后检查
- [ ] GitHub Release 已创建
- [ ] 所有平台的安装包已上传
- [ ] `latest-*.yml` 文件已上传 ⚠️ **最重要！**
- [ ] Release Notes 正确显示

### ✅ 用户端检查
- [ ] 启动应用 5 秒后弹出更新提示
- [ ] 显示正确的版本号（当前 vs 最新）
- [ ] 下载进度正常显示
- [ ] 下载完成后可以重启安装
- [ ] 安装后版本号更新

---

## 🐛 常见问题排查

### 问题 1: 用户端无法检测到更新

**检查**:
```bash
# 检查 latest-mac.yml 是否存在
curl -I https://github.com/xiongsircool/aurora-rss-reader/releases/download/latest/latest-mac.yml

# 应该返回 200 OK
```

**原因**:
- `latest-mac.yml` 文件未上传
- GitHub Release 设置为 Draft
- 版本号格式错误

**解决**:
```bash
# 检查 GitHub Actions 日志
# 确认 .yml 文件已上传
```

### 问题 2: GitHub Actions 构建失败

**检查**:
- [GitHub Actions](https://github.com/xiongsircool/aurora-rss-reader/actions)
- 查看错误日志

**常见原因**:
- 依赖安装失败
- 编译错误
- 权限问题（GH_TOKEN）

### 问题 3: 下载更新失败

**检查**:
```bash
# 查看用户端日志
tail -f ~/Library/Application\ Support/Aurora\ RSS\ Reader/desktop_startup.log
```

**常见原因**:
- 网络连接问题
- GitHub 限流
- 文件损坏

---

## 📚 进阶配置

### macOS 代码签名（可选，但推荐）

```bash
# 1. 申请 Apple Developer 证书（$99/年）
# 2. 导出证书为 .p12 文件
# 3. Base64 编码
base64 -i certificate.p12 -o certificate.txt

# 4. 添加到 GitHub Secrets
# Settings → Secrets → New repository secret
# Name: CSC_LINK
# Value: (paste base64 content)

# 5. 添加其他 Secrets
# CSC_KEY_PASSWORD: 证书密码
# APPLE_ID: Apple ID
# APPLE_APP_SPECIFIC_PASSWORD: 应用专用密码
# APPLE_TEAM_ID: 团队 ID
```

### 自定义更新检查频率

编辑 `rss-desktop/electron/autoUpdater.ts`:

```typescript
// 修改启动延迟（默认 5 秒）
setTimeout(() => {
  autoUpdater.checkForUpdates()
}, 10000)  // 改为 10 秒

// 添加定期检查（每小时）
setInterval(() => {
  autoUpdater.checkForUpdates()
}, 3600000)  // 3600000ms = 1 小时
```

---

## 📖 相关文档

- [机制详解](AUTO_UPDATE_MECHANISM.md) - 深入了解版本识别、更新流程和安全机制
- [错误排查](AUTO_UPDATE_TROUBLESHOOTING.md) - 完整的错误诊断和解决方案（12 种常见场景）

---

## 🎉 完成！

自动更新功能已经完全集成，现在可以：

1. ✅ **立即使用**：推送新版本 tag，自动构建发布
2. ✅ **用户受益**：无需手动下载，一键更新
3. ✅ **开发高效**：CI/CD 自动化，省时省力

**下一步**：
- 推送 `v0.1.5` tag 进行第一次自动更新测试
- 分享给用户，收集反馈
- 持续优化用户体验

---

**需要帮助？**
- 查看日志: `~/Library/Application Support/Aurora RSS Reader/desktop_startup.log`
- GitHub Issues: https://github.com/xiongsircool/aurora-rss-reader/issues
