# 构建和部署

## 📦 构建脚本

### 生产构建
```bash
# 构建完整的桌面应用（推荐）
./build-release-app.sh
```

构建完成后，安装包会生成在 `rss-desktop/release/` 目录下。

### 开发环境
```bash
# 启动开发环境
./start.sh
```

## 🔧 构建工具

### 安全扫描
```bash
# 扫描敏感信息
./tools/scan-secrets.sh
```

在提交代码前运行此脚本，确保没有敏感信息泄露。

## 📋 构建输出

### macOS
- `Aurora RSS Reader-Mac-0.1.0-x64.dmg` - Intel Mac
- `Aurora RSS Reader-Mac-0.1.0-arm64.dmg` - Apple Silicon

### Windows
- `Aurora RSS Reader-Setup-0.1.0.exe` - 安装包
- `Aurora RSS Reader-0.1.0.exe` - 便携版

### Linux
- `aurora-rss-reader-0.1.0.AppImage` - AppImage
- `aurora-rss-reader_0.1.0_amd64.deb` - Debian 包

## ⚙️ 构建配置

### Electron Builder 配置
配置文件：`rss-desktop/electron-builder.json5`

### PyInstaller 配置
配置文件：`backend/backend.spec`

## 📝 构建签名

每次构建会生成 `build_signature.json`，包含：
- 构建时间和作者信息
- Git 提交哈希
- 构建指纹

此文件用于验证构建的完整性和来源。