# Aurora RSS Reader

![Banner](images/banner_sharp_aurora.png)

<p align="center">
  <a href="https://github.com/xiongsircool/aurora-rss-reader">
    <img alt="GitHub stars" src="https://img.shields.io/github/stars/xiongsircool/aurora-rss-reader?style=social">
  </a>
  <a href="https://github.com/xiongsircool/aurora-rss-reader">
    <img alt="GitHub forks" src="https://img.shields.io/github/forks/xiongsircool/aurora-rss-reader?style=social">
  </a>
  <a href="https://github.com/xiongsircool/aurora-rss-reader/issues">
    <img alt="GitHub issues" src="https://img.shields.io/github/issues/xiongsircool/aurora-rss-reader">
  </a>
  <a href="https://github.com/xiongsircool/aurora-rss-reader/blob/main/LICENSE">
    <img alt="License: GPL v3" src="https://img.shields.io/badge/License-GPLv3-blue.svg">
  </a>
</p>

<p align="center">
  <a href="README.md">🇨🇳 中文</a> • <a href="README_EN.md">🇺🇸 English</a>
</p>

<div align="center">
  <img alt="Aurora RSS Reader" src="images/带版本号和软件名图标.png" height="120" />
</div>

## 简介

Aurora RSS Reader 是一个现代化的跨平台桌面 RSS 阅读器，集成了 AI 翻译和摘要功能。基于 Electron + Vue 3 + FastAPI 技术栈构建，提供流畅的用户体验和强大的功能支持。支持多种布局模式，本地数据存储，以及丰富的自定义选项。

**当前版本：v0.1.0**

## 功能特色

### 阅读体验
- **多种布局模式** - 支持三栏式和一栏式布局
- **分组管理** - 将 RSS 源按分类整理
- **全文搜索** - 在标题和内容中快速查找
- **收藏功能** - 收藏重要文章便于后续阅读
- **时间过滤** - 按发布时间筛选文章

### 智能功能
- **文章摘要** - 自动生成文章要点，快速了解内容
- **多语言翻译** - 支持全文和标题翻译，阅读无障碍
- **多语言界面** - 中文、英文、日语、韩语界面支持
- **灵活配置** - 支持多种翻译和摘要服务

### 系统功能
- **本地存储** - SQLite 数据库，离线可用
- **OPML 导入导出** - 方便数据迁移
- **自动刷新** - 定时获取最新文章
- **深色模式** - 支持深色和浅色主题
- **RSSHub 支持** - 扩展 RSS 源覆盖范围
- **窗口管理** - 优化的 macOS 窗口生命周期管理
- **多平台支持** - Windows、macOS、Linux 全平台兼容

### 界面预览

#### 🎨 布局模式
<div align="center">
  <table>
    <tr>
      <td align="center" width="60%">
        <img src="images/appimages/三栏式布局.png" alt="三栏式布局" width="100%" style="max-width:600px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.12);" />
        <br><strong>三栏式布局</strong>
        <br><em>经典桌面阅读体验</em>
      </td>
      <td align="center" width="40%">
        <img src="images/appimages/一拦式布局.png" alt="一栏式布局" width="100%" style="max-width:280px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.12);" />
        <br><strong>一栏式布局</strong>
        <br><em>专注阅读模式</em>
      </td>
    </tr>
  </table>
</div>

#### 🌍 多语言界面
<div align="center">
  <table>
    <tr>
      <td align="center" width="25%">
        <img src="images/appimages/多语言支持中文.png" alt="中文界面" width="100%" style="max-width:200px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.1);" />
        <br><strong>🇨🇳 中文</strong>
      </td>
      <td align="center" width="25%">
        <img src="images/appimages/多语言支持英文.png" alt="English Interface" width="100%" style="max-width:200px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.1);" />
        <br><strong>🇺🇸 English</strong>
      </td>
      <td align="center" width="25%">
        <img src="images/appimages/多语言支持日语.png" alt="日本語" width="100%" style="max-width:200px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.1);" />
        <br><strong>🇯🇵 日本語</strong>
      </td>
      <td align="center" width="25%">
        <img src="images/appimages/多语言支持韩文.png" alt="한국어" width="100%" style="max-width:200px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.1);" />
        <br><strong>🇰🇷 한국어</strong>
      </td>
    </tr>
  </table>
</div>

#### ⚙️ 核心功能
<div align="center">
  <table>
    <tr>
      <td align="center" width="33.33%">
        <img src="images/appimages/支持订阅分组.png" alt="分组管理" width="100%" style="max-width:300px;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,0.1);" />
        <br><strong>📁 订阅源分组</strong>
        <br><em>智能分类管理</em>
      </td>
      <td align="center" width="33.33%">
        <img src="images/appimages/支持订阅信息时间过滤设定.png" alt="时间过滤" width="100%" style="max-width:300px;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,0.1);" />
        <br><strong>⏰ 时间过滤</strong>
        <br><em>精准内容筛选</em>
      </td>
      <td align="center" width="33.33%">
        <img src="images/appimages/支持特定内容收藏.png" alt="收藏功能" width="100%" style="max-width:300px;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,0.1);" />
        <br><strong>⭐ 收藏功能</strong>
        <br><em>重要内容标记</em>
      </td>
    </tr>
  </table>
</div>

## 快速开始

### 系统要求
- Node.js 18+
- Python 3.12+
- pnpm 8+

### 安装运行
```bash
# 克隆仓库
git clone https://github.com/xiongsircool/aurora-rss-reader.git
cd aurora-rss-reader

# 一键启动
chmod +x start.sh
./start.sh
```

启动脚本会自动：
- 创建 Python 虚拟环境
- 安装前后端依赖
- 初始化数据库
- 启动 Electron 应用

### 访问地址
- **桌面应用**：自动打开 Electron 窗口
- **Web 界面**：http://localhost:5173
- **API 服务**：http://127.0.0.1:15432

### 配置文件
编辑 `backend/.env` 配置 AI 和 RSSHub：

```env
# RSSHub
RSSHUB_BASE=https://rsshub.app

# AI 配置
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4/
GLM_MODEL=glm-4-flash
GLM_API_KEY=your_api_key_here
```

### 数据存储目录
- **macOS**：`~/Library/Application Support/Aurora RSS Reader/rss.sqlite`
- **Windows**：`%APPDATA%/Aurora RSS Reader/rss.sqlite`
- **Linux**：`~/.config/aurora-rss-reader/rss.sqlite`
- 可通过设置环境变量 `AURORA_DATA_DIR` 或在 `backend/.env` 中指定 `SQLITE_PATH` 来覆盖默认位置，方便在多设备或自定义路径间迁移数据。

## 构建发布

```bash
# 构建安装包
chmod +x build-release-app.sh
./build-release-app.sh
```

生成的文件：
- macOS: `Aurora RSS Reader-Mac-0.1.0-{x64,arm64}.dmg`
- Windows: `Aurora RSS Reader-Setup-0.1.0.exe`
- Linux: `aurora-rss-reader-0.1.0.AppImage`

详细构建说明请参考 [构建文档](docs/development/build.md)。

## 技术栈

- **前端**：Vue 3 + Vite + Pinia + TypeScript
- **后端**：FastAPI + SQLModel + SQLite
- **桌面应用**：Electron
- **构建工具**：PyInstaller + electron-builder

## 项目结构

```
aurora-rss-reader/
├── rss-desktop/          # 前端代码
│   ├── src/             # Vue 源码
│   └── electron/        # Electron 主进程
├── backend/             # 后端服务
│   ├── app/            # FastAPI 应用
│   └── .venv/          # Python 虚拟环境
├── images/              # 图片资源
└── start.sh            # 启动脚本
```

## 📋 更新日志

### v0.1.0 (当前版本)
#### 新增功能
- ✨ 多布局模式支持（三栏式、一栏式）
- ✨ AI 翻译和摘要功能集成
- ✨ 多语言界面支持（中文、英文、日语、韩语）
- ✨ RSS 订阅分组管理
- ✨ 文章收藏和时间过滤
- ✨ 全文搜索功能
- ✨ OPML 导入导出

#### 优化改进
- 🐛 修复 macOS 窗口生命周期管理问题
- 🎨 优化界面布局和用户体验
- 🔄 改进时区处理，统一时间显示
- ⚡ 增强应用启动和窗口恢复性能

## 📚 文档

- **[完整文档](docs/README.md)** - 所有文档的入口
- **[RSSHub 配置](docs/guides/RSSHUB_CONFIG_GUIDE.md)** - 自定义 RSSHub 实例
- **[RSSHub 故障排除](docs/guides/RSSHUB_TROUBLESHOOTING.md)** - 连接问题排查
- **[开发指南](docs/development/CONTRIBUTING.md)** - 贡献代码和开发设置
- **[后端文档](docs/development/backend.md)** - 后端架构和 API
- **[构建文档](docs/development/build.md)** - 构建和部署说明
- **[更新日志](docs/CHANGELOG.md)** - 详细版本更新记录

## ❓ 常见问题

### macOS 相关
**Q: macOS 上关闭窗口后，为什么从 dock 栏点击会报错？**
A: 这个问题已在 v0.1.0 版本中修复。如果仍有问题，请确保使用最新版本。

**Q: 如何在 macOS 上完全退出应用？**
A: 使用 `Cmd + Q` 快捷键或右键点击 dock 图标选择退出。

### 配置相关
**Q: 如何配置 AI 服务？**
A: 编辑 `backend/.env` 文件，添加相应的 API 密钥。详细配置请参考 [配置文档](docs/guides/RSSHUB_CONFIG_GUIDE.md)。

**Q: 数据存储在哪里？**
A: 数据默认存储在系统应用数据目录：
- macOS: `~/Library/Application Support/Aurora RSS Reader/rss.sqlite`
- Windows: `%APPDATA%/Aurora RSS Reader/rss.sqlite`
- Linux: `~/.config/aurora-rss-reader/rss.sqlite`

### 性能相关
**Q: 应用启动慢怎么办？**
A: 检查后端服务是否正常启动，可以查看终端输出的启动日志。

## 支持

- **问题反馈**：[GitHub Issues](https://github.com/xiongsircool/aurora-rss-reader/issues)
- **功能建议**：[GitHub Discussions](https://github.com/xiongsircool/aurora-rss-reader/discussions)
- **邮件联系**：1666526339@qq.com

## 许可证

本项目使用 [GNU General Public License v3.0](LICENSE)，这是一个 copyleft 开源许可证，要求衍生作品也必须开源。

---

## 🎯 未来规划

### 近期计划 (v0.2)
- [ ] **移动端支持** - 开发iOS和Android平台的移动应用
- [ ] **AI日报功能** - 智能生成每日热点新闻摘要和个性化推荐
- [ ] **播客支持** - 支持音频播客订阅和播放功能
- [ ] **阅读统计** - 个人阅读习惯分析和数据可视化

### 中期计划 (v0.3)
- [ ] **数据同步** - 跨设备数据同步和云备份
- [ ] **插件系统** - 支持第三方插件扩展功能

---

觉得有用就给个 ⭐ 吧！
