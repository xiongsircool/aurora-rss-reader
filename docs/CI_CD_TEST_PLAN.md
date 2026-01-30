# 🧪 GitHub Actions 测试计划

## 📊 当前状态

### 版本历史
- ✅ v0.1.1 - 已发布
- ✅ v0.1.2 - 已发布
- ✅ v0.1.3 - 已发布
- ✅ v0.1.4 - 已发布（最新）

### 当前 package.json 版本
```json
"version": "0.1.4"
```

---

## 🎯 测试方案

### 方案 1: 创建测试标签（推荐）

使用 prerelease 版本测试，不影响正式发布：

```bash
# 1. 更新到 prerelease 版本
cd rss-desktop
npm version prerelease --preid=test
# 将创建: 0.1.5-test.0

# 2. 提交变更
git add package.json
git commit -m "test: create test version for CI/CD validation"

# 3. 创建测试标签
git tag v0.1.5-test.0

# 4. 推送到 GitHub（触发 Actions）
git push origin feature/nodejs-backend
git push origin v0.1.5-test.0

# 5. 观察 GitHub Actions
# https://github.com/xiongsircool/aurora-rss-reader/actions
```

**优点**：
- ✅ 不影响正式版本号
- ✅ 可以测试 CI/CD 流程
- ✅ 可以验证自动更新配置
- ✅ 失败了可以删除重试

**注意**：
- prerelease 标签会触发构建
- Release 会标记为 "Pre-release"
- 用户不会自动更新到 prerelease 版本

---

### 方案 2: 直接发布 v0.1.5（生产环境）

如果确定要正式发布：

```bash
# 1. 更新版本号
cd rss-desktop
npm version patch
# 将创建: 0.1.5

# 2. 推送到 main 分支
git push origin main --tags

# 3. 等待 GitHub Actions 自动构建
```

**优点**：
- ✅ 直接进入生产
- ✅ 用户立即可用

**风险**：
- ⚠️ 如果 CI/CD 有问题，需要紧急修复
- ⚠️ 版本号会递增

---

## 🔍 检查清单

### 发布前检查

```bash
# 1. 确保在正确的分支
git branch

# 2. 确保代码已同步到远程
git status
git pull origin feature/nodejs-backend

# 3. 本地构建测试
cd rss-desktop
pnpm clean
pnpm install
pnpm build

# 4. 本地打包测试（可选）
pnpm pack

# 5. 检查 GitHub Actions 配置
cat ../.github/workflows/build-release.yml | grep "on:"
```

### 发布后监控

1. **GitHub Actions 页面**
   ```
   https://github.com/xiongsircool/aurora-rss-reader/actions
   ```
   - 查看工作流是否触发
   - 监控构建进度
   - 检查是否有错误

2. **构建步骤检查**
   - [ ] macOS 构建成功
   - [ ] Windows 构建成功
   - [ ] Linux 构建成功
   - [ ] Release 创建成功
   - [ ] 文件上传成功

3. **Release 文件检查**
   ```
   https://github.com/xiongsircool/aurora-rss-reader/releases
   ```
   - [ ] 所有平台的安装包
   - [ ] `latest-mac.yml` ⚠️ 最重要
   - [ ] `latest.yml` (Windows)
   - [ ] `latest-linux.yml`

---

## 🧪 推荐的测试流程

### 步骤 1: 验证本地构建

```bash
cd /Users/Apple/Documents/githubs/aurora-rss-reader/rss-desktop

# 清理
pnpm clean

# 安装依赖
pnpm install

# 类型检查
pnpm typecheck

# 构建
pnpm build

# 打包测试（可选，耗时较长）
# pnpm pack
```

**预期结果**：
- ✅ TypeScript 编译通过
- ✅ 前端构建成功
- ✅ Electron 主进程构建成功
- ✅ 所有文件生成正确

---

### 步骤 2: 创建测试标签

```bash
# 确保在正确的分支
git checkout feature/nodejs-backend
git pull origin feature/nodejs-backend

# 创建测试版本
cd rss-desktop
npm version prerelease --preid=test

# 查看新版本
cat package.json | grep version
# 应该显示: "version": "0.1.5-test.0"

# 提交
git add package.json
git commit -m "test: CI/CD validation for auto-update"

# 创建标签
git tag v0.1.5-test.0

# 推送（触发 GitHub Actions）
git push origin feature/nodejs-backend
git push origin v0.1.5-test.0
```

---

### 步骤 3: 监控构建

1. **立即打开 GitHub Actions**
   ```
   https://github.com/xiongsircool/aurora-rss-reader/actions
   ```

2. **观察工作流运行**
   - 等待触发（通常几秒钟）
   - 查看实时日志
   - 注意任何错误或警告

3. **估计时间**
   - macOS 构建: ~8-10 分钟
   - Windows 构建: ~6-8 分钟
   - Linux 构建: ~5-7 分钟
   - **总计约 20-25 分钟**

---

### 步骤 4: 验证 Release

构建完成后，检查：

```
https://github.com/xiongsircool/aurora-rss-reader/releases
```

**必须包含的文件**：

macOS:
- [x] AuroraRSSReader-Mac-0.1.5-test.0.dmg
- [x] AuroraRSSReader-Mac-0.1.5-test.0.zip
- [x] latest-mac.yml ⚠️ 关键

Windows:
- [x] AuroraRSSReader-Windows-0.1.5-test.0-x64-Setup.exe
- [x] AuroraRSSReader-Windows-0.1.5-test.0-arm64-Setup.exe
- [x] latest.yml ⚠️ 关键

Linux:
- [x] AuroraRSSReader-Linux-0.1.5-test.0-x64.AppImage
- [x] AuroraRSSReader-Linux-0.1.5-test.0-arm64.AppImage
- [x] latest-linux.yml ⚠️ 关键

---

### 步骤 5: 清理测试版本（如果需要）

如果测试失败，可以删除：

```bash
# 删除本地标签
git tag -d v0.1.5-test.0

# 删除远程标签
git push origin :refs/tags/v0.1.5-test.0

# 删除 GitHub Release
# 在 GitHub 网页上手动删除

# 回退 package.json
cd rss-desktop
npm version 0.1.4 --no-git-tag-version
git checkout package.json
```

---

## ⚠️ 可能遇到的问题

### 问题 1: 构建失败

**症状**：GitHub Actions 显示红色 ❌

**诊断**：
1. 点击失败的工作流
2. 查看详细日志
3. 找到错误信息

**常见原因**：
- 依赖安装失败
- 编译错误
- 内存不足
- 权限问题

**解决**：
- 查看 [错误排查文档](AUTO_UPDATE_TROUBLESHOOTING.md)
- 或直接找我帮忙

---

### 问题 2: Release 创建但文件缺失

**症状**：Release 存在，但缺少 `.yml` 文件

**诊断**：
```bash
# 检查本地打包是否生成 yml
cd rss-desktop
pnpm pack
ls -la release/**/*.yml
```

**解决**：
- 确认 `electron-builder.json5` 配置正确
- 确认 `.github/workflows/build-release.yml` 包含 `**/*.yml`

---

### 问题 3: 工作流没有触发

**症状**：推送 tag 后 Actions 页面没有新的运行

**原因**：
- 标签格式不正确（必须是 `v*`）
- 工作流配置错误
- 推送到错误的分支

**解决**：
```bash
# 检查标签格式
git tag -l | grep v0.1.5

# 手动触发工作流
# GitHub → Actions → Build and Release → Run workflow
```

---

## 🎯 建议

### 现在就开始测试

```bash
# 执行步骤 1: 本地构建验证
cd /Users/Apple/Documents/githubs/aurora-rss-reader/rss-desktop
pnpm clean && pnpm install && pnpm typecheck && pnpm build

# 如果成功，告诉我，我们继续步骤 2
```

### 或者

如果你想直接发布正式版本，我们可以：

```bash
# 直接升级到 v0.1.5
npm version patch
git push origin main --tags
```

---

**你想先测试 prerelease 版本，还是直接发布正式版本？** 🤔
