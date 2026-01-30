# 🛠️ 自动更新错误排查和解决指南

## 常见错误及解决方案

---

## 📋 目录
- [构建错误](#构建错误)
- [运行时错误](#运行时错误)
- [发布错误](#发布错误)
- [用户端错误](#用户端错误)
- [紧急联系](#紧急联系)

---

## 🔨 构建错误

### 错误 1: TypeScript 编译错误

#### 症状
```bash
pnpm typecheck
# error TS2345: Argument of type '...' is not assignable...
```

#### 诊断
```bash
# 检查自动更新相关文件的类型错误
pnpm typecheck 2>&1 | grep -E "(autoUpdater|UpdateNotification|electron\.d\.ts)"
```

#### 解决方案
```bash
# 1. 检查类型定义文件
cat rss-desktop/src/types/electron.d.ts

# 2. 如果有类型错误，临时跳过类型检查构建
cd rss-desktop
pnpm build --no-typecheck  # 注意：仅用于测试

# 3. 正确方案：修复类型定义
# 联系我，我会帮你修复
```

### 错误 2: 依赖安装失败

#### 症状
```bash
pnpm install
# ERR_PNPM_...
```

#### 解决方案
```bash
# 1. 清理缓存
pnpm store prune
rm -rf node_modules pnpm-lock.yaml

# 2. 重新安装
pnpm install

# 3. 如果仍然失败，使用 npm
npm install
```

### 错误 3: electron-builder 打包失败

#### 症状
```bash
pnpm pack
# Error: Application entry file "dist-electron/main.js" does not exist
```

#### 解决方案
```bash
# 1. 确保先构建
pnpm build

# 2. 检查构建产物
ls -la dist-electron/

# 3. 如果缺少文件
pnpm clean
pnpm build
pnpm pack
```

---

## ⚡ 运行时错误

### 错误 4: autoUpdater 模块导入失败

#### 症状
```
Error: Cannot find module './autoUpdater'
```

#### 诊断
```bash
# 检查文件是否存在
ls -la rss-desktop/electron/autoUpdater.ts
ls -la rss-desktop/dist-electron/autoUpdater.js
```

#### 解决方案
```bash
# 1. 确保 autoUpdater.ts 存在
cat rss-desktop/electron/autoUpdater.ts | head -5

# 2. 重新构建
cd rss-desktop
pnpm clean
pnpm build
pnpm dev:electron
```

### 错误 5: window.electron undefined

#### 症状
- 前端组件无法调用 `window.electron.checkForUpdates()`
- 控制台报错: `Cannot read property 'checkForUpdates' of undefined`

#### 诊断
```typescript
// 在浏览器控制台运行
console.log(window.electron)
// 应该输出: { checkForUpdates: ƒ, getAppVersion: ƒ, ... }
```

#### 解决方案
```bash
# 1. 检查 preload.ts 是否正确编译
cat rss-desktop/dist-electron/preload.js | grep "window.electron"

# 2. 检查 main.ts 中的 preload 路径
cat rss-desktop/electron/main.ts | grep "preload:"

# 3. 重新构建
pnpm clean
pnpm build
```

### 错误 6: 开发环境无法检测更新

#### 症状
- 启动应用后没有更新提示
- 日志显示: `⚠️ 开发环境，跳过自动更新`

#### 这是正常行为！
```typescript
// rss-desktop/electron/autoUpdater.ts:18-21
if (process.env.NODE_ENV === 'development') {
  log.info('⚠️  开发环境，跳过自动更新')
  return
}
```

#### 测试方案
```bash
# 方案 1: 构建生产版本测试
pnpm pack
open release/*/Aurora\ RSS\ Reader.app

# 方案 2: 临时移除开发环境检查
# 编辑 electron/autoUpdater.ts，注释掉第 18-21 行
# 注意：测试完后记得恢复！
```

---

## 🚀 发布错误

### 错误 7: GitHub Actions 构建失败

#### 症状
- GitHub Actions 工作流失败
- 错误: `Error: Process completed with exit code 1`

#### 诊断步骤
```bash
# 1. 查看 Actions 日志
# https://github.com/xiongsircool/aurora-rss-reader/actions

# 2. 检查失败的步骤
# 常见失败点:
# - Install dependencies
# - Build backend
# - Build and package
```

#### 常见原因和解决方案

##### 原因 1: 依赖安装失败
```yaml
# .github/workflows/build-release.yml
# 确保 pnpm 版本正确
- name: Setup pnpm
  uses: pnpm/action-setup@v2
  with:
    version: 8  # 或者更高版本
```

##### 原因 2: 构建失败
```bash
# 本地复现
cd rss-desktop
pnpm clean
pnpm install
pnpm build
pnpm pack
```

##### 原因 3: 权限问题
```yaml
# 确保 GH_TOKEN 有正确权限
env:
  GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 错误 8: Release 创建失败

#### 症状
- 构建成功，但没有创建 Release
- 或者 Release 创建了但是文件缺失

#### 诊断
```bash
# 1. 检查是否推送了 tag
git tag -l
git push origin main --tags

# 2. 检查工作流触发条件
# .github/workflows/build-release.yml:6-7
# on:
#   push:
#     tags:
#       - 'v*'
```

#### 解决方案
```bash
# 1. 确保 tag 格式正确
git tag v0.1.5  # ✅ 正确
git tag 0.1.5   # ❌ 错误，缺少 v 前缀

# 2. 手动触发工作流
# GitHub → Actions → Build and Release → Run workflow

# 3. 检查 Release 文件
# https://github.com/xiongsircool/aurora-rss-reader/releases
# 必须包含: *.dmg, *.zip, latest-*.yml
```

### 错误 9: latest-*.yml 文件缺失

#### 症状
- Release 中没有 `latest-mac.yml` 文件
- 用户端无法检测到更新

#### 诊断
```bash
# 检查本地构建是否生成 yml 文件
cd rss-desktop
pnpm pack
ls -la release/**/*.yml

# 应该看到:
# release/0.1.5/latest-mac.yml
# release/0.1.5/latest.yml
# release/0.1.5/latest-linux.yml
```

#### 解决方案
```bash
# 1. 检查 electron-builder.json5 配置
cat rss-desktop/electron-builder.json5 | grep -A 5 "publish"

# 应该包含:
# "publish": [
#   {
#     "provider": "github",
#     "owner": "xiongsircool",
#     "repo": "aurora-rss-reader"
#   }
# ]

# 2. 检查 CI/CD 配置
cat .github/workflows/build-release.yml | grep "\.yml"

# 应该包含:
# path: |
#   rss-desktop/release/**/*.yml

# 3. 如果文件生成但未上传，手动上传
# GitHub Releases → Edit → 拖拽 latest-*.yml 文件
```

---

## 👥 用户端错误

### 错误 10: 无法检测到更新

#### 用户症状
- 启动应用后没有更新提示
- 已知有新版本发布

#### 诊断步骤
```bash
# 1. 检查当前版本
# 应用 → 关于 → 版本号

# 2. 检查日志文件
tail -f ~/Library/Application\ Support/Aurora\ RSS\ Reader/desktop_startup.log

# 应该看到:
# [时间] 🔄 初始化自动更新器
# [时间] 🔍 开始检查更新...
# [时间] ✨ 发现新版本: x.x.x
# 或者:
# [时间] ✅ 当前已是最新版本
```

#### 可能原因和解决方案

##### 原因 1: 网络连接问题
```bash
# 测试网络连接
curl -I https://github.com/xiongsircool/aurora-rss-reader/releases/download/latest/latest-mac.yml

# 应该返回: HTTP/2 200
```

##### 原因 2: GitHub Releases 文件缺失
```bash
# 检查 Release 是否包含必要文件
open https://github.com/xiongsircool/aurora-rss-reader/releases/latest

# 必须包含:
# - latest-mac.yml (macOS)
# - latest.yml (Windows)
# - latest-linux.yml (Linux)
```

##### 原因 3: 版本号格式错误
```bash
# 检查 package.json
cat rss-desktop/package.json | grep version

# 正确格式: "version": "0.1.5"
# 错误格式: "version": "v0.1.5"
```

##### 原因 4: Release 设置为 Draft
```
GitHub Releases → 检查是否标记为 "Draft"
如果是 Draft，点击 "Publish release"
```

### 错误 11: 下载更新失败

#### 用户症状
- 点击"立即下载"后失败
- 错误提示: "网络连接失败" 或 "下载失败"

#### 解决方案
```bash
# 方案 1: 重试下载
# 点击错误对话框中的"重试"按钮

# 方案 2: 手动下载
# 点击"手动下载"按钮
# 或访问: https://github.com/xiongsircool/aurora-rss-reader/releases/latest

# 方案 3: 检查防火墙/代理设置
# 确保应用可以访问 GitHub
```

### 错误 12: 安装更新失败

#### 用户症状
- 下载完成后，重启安装失败
- macOS: "文件已损坏" 或 "无法验证开发者"

#### macOS 解决方案
```bash
# 如果提示"文件已损坏"
# 原因：应用未签名

# 临时解决（仅限测试）：
sudo xattr -cr /Applications/Aurora\ RSS\ Reader.app

# 永久解决：开发者需要申请 Apple 证书签名
```

#### Windows 解决方案
```bash
# 如果 Windows Defender 阻止
# 1. 右键安装包 → 属性 → 解除阻止
# 2. 或临时关闭实时保护
```

---

## 🔍 调试工具

### 查看日志文件

#### macOS
```bash
tail -f ~/Library/Application\ Support/Aurora\ RSS\ Reader/desktop_startup.log
```

#### Windows
```powershell
Get-Content "$env:APPDATA\Aurora RSS Reader\desktop_startup.log" -Tail 50 -Wait
```

#### Linux
```bash
tail -f ~/.config/aurora-rss-reader/desktop_startup.log
```

### 启用详细日志

```typescript
// 编辑 rss-desktop/electron/autoUpdater.ts

// 修改日志级别
log.transports.file.level = 'debug'  // 'info' → 'debug'

// 重新构建
pnpm build
```

### 手动测试更新 API

```bash
# 检查 GitHub Releases API
curl https://api.github.com/repos/xiongsircool/aurora-rss-reader/releases/latest

# 检查更新清单文件
curl https://github.com/xiongsircool/aurora-rss-reader/releases/download/latest/latest-mac.yml
```

---

## 🆘 紧急联系

### 如果遇到无法解决的错误

1. **收集信息**:
   - 错误截图
   - 日志文件内容
   - 操作系统版本
   - 应用版本号

2. **提交 Issue**:
   ```bash
   # 访问 GitHub Issues
   open https://github.com/xiongsircool/aurora-rss-reader/issues/new

   # 标题格式: [自动更新] 简短描述问题
   # 例如: [自动更新] macOS 无法检测到新版本
   ```

3. **包含以下信息**:
   ```markdown
   ## 环境信息
   - OS: macOS 14.0 / Windows 11 / Ubuntu 22.04
   - 应用版本: 0.1.4
   - 最新版本: 0.1.5

   ## 错误描述
   [详细描述问题]

   ## 复现步骤
   1. 打开应用
   2. 等待 5 秒
   3. ...

   ## 日志内容
   ```
   [粘贴日志内容]
   ```

   ## 截图
   [上传错误截图]
   ```

4. **联系我**:
   - 在这个对话中直接告诉我错误信息
   - 我会立即帮你解决！

---

## 🎯 快速诊断清单

遇到错误时，按顺序检查：

### 构建阶段
- [ ] 依赖是否正确安装？(`pnpm install`)
- [ ] TypeScript 是否编译通过？(`pnpm typecheck`)
- [ ] 构建是否成功？(`pnpm build`)
- [ ] 打包是否成功？(`pnpm pack`)

### 发布阶段
- [ ] Git tag 是否正确？(`git tag -l`)
- [ ] CI/CD 是否成功？(检查 GitHub Actions)
- [ ] Release 是否创建？(检查 GitHub Releases)
- [ ] 文件是否完整？(包含 `latest-*.yml`)

### 用户端
- [ ] 网络连接是否正常？(`curl` 测试)
- [ ] 版本号是否正确？(检查 `package.json`)
- [ ] 日志是否有错误？(查看日志文件)
- [ ] Release 是否为 Draft？(检查 GitHub)

---

## 💡 预防性措施

### 发布前检查清单

```bash
# 1. 本地完整测试
cd rss-desktop
pnpm clean
pnpm install
pnpm typecheck
pnpm build
pnpm pack

# 2. 验证生成的文件
ls -la release/**/*.{dmg,zip,yml}

# 3. 测试打开应用
open release/*/Aurora\ RSS\ Reader.app

# 4. 检查版本号
cat package.json | grep version

# 5. 确认 git 状态
git status
git log -1

# 6. 推送前最后确认
git tag -l | tail -5
```

---

## 📚 相关资源

- [快速开始指南](AUTO_UPDATE_QUICK_START.md)
- [机制详解](AUTO_UPDATE_MECHANISM.md)
- [开发者手册](AUTO_UPDATE_DEVELOPER_GUIDE.md)
- [GitHub Issues](https://github.com/xiongsircool/aurora-rss-reader/issues)

---

**记住：遇到任何问题都可以随时找我！我会帮你快速解决。** 🚀
