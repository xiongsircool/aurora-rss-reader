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

<div align="center">
  <img alt="Aurora RSS Reader" src="images/带版本号和软件名图标.png" height="120" />
</div>

## 📋 更新公告 | Update News

### 🎉 v0.1.3 最新版本 | Latest Version

**打包修复与平台支持 | Packaging Fix & Platform Support**

- 🔧 **修复Windows打包** - 解决 PyInstaller 依赖问题，后端现在可以正确启动
- 🍎 **macOS Intel 支持** - 新增对老款 Intel Mac (x64) 的支持
- 📦 **构建系统优化** - 确保所有模块依赖正确包含在打包应用中
- 🗄️ **数据库初始化** - 修复首次启动时数据库表创建问题
- ⚡ **启动优化** - 延长后端启动超时时间，适配性能较慢的系统
- ✅ **一键已读** - 新增批量标记所有文章为已读功能
- 🌙 **深色模式修复** - 修复设置页面在深色模式下的显示异常

---

Aurora RSS Reader is a modern cross-platform desktop RSS reader integrated with AI translation and summarization features. Built with Electron + Vue 3 + FastAPI stack, providing smooth user experience and powerful functionality.

**Current Version: v0.1.3**

## 🇨🇳 中文 | 🇺🇸 English

<details>
<summary><strong>📖 查看英文介绍 | View English Introduction</strong></summary>

## Introduction

Aurora RSS Reader is a cross-platform desktop RSS reader integrated with AI translation and summarization features. It supports multiple layout modes, local data storage, and rich customization options.

**Current Version: v0.1.3**

### Features | 功能特色

#### 🎨 Reading Experience | 阅读体验
- **Multi-layout Support | 多种布局模式** - Three-column and single-column layouts
- **Group Management | 分组管理** - Organize RSS sources by categories
- **Full-text Search | 全文搜索** - Quick search in titles and content
- **Favorites Feature | 收藏功能** - Bookmark important articles for later reading
- **Time Filtering | 时间过滤** - Filter articles by publish time

#### 🤖 Smart Features | 智能功能
- **Article Summarization | 文章摘要** - Automatically generate article summaries
- **Multi-language Translation | 多语言翻译** - Translate full text and titles
- **Multi-language Interface | 多语言界面** - Chinese, English, Japanese, Korean support

#### 🔧 System Features | 系统功能
- **Local Storage | 本地存储** - SQLite database, offline available
- **OPML Import/Export | OPML 导入导出** - Easy data migration
- **Auto Refresh | 自动刷新** - Regularly fetch latest articles
- **Dark Mode | 深色模式** - Support for light and dark themes
- **Cross-platform Support | 跨平台支持** - Windows, macOS, Linux

### Quick Start | 快速开始

```bash
# Clone repository | 克隆仓库
git clone https://github.com/xiongsircool/aurora-rss-reader.git
cd aurora-rss-reader

# Start with one click | 一键启动
chmod +x start.sh
./start.sh
```

### Tech Stack | 技术栈

- **Frontend | 前端**: Vue 3 + Vite + Pinia + TypeScript
- **Backend | 后端**: FastAPI + SQLModel + SQLite
- **Desktop | 桌面**: Electron
- **Build | 构建**: PyInstaller + electron-builder

</details>

---

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
- macOS: `AuroraRSSReader-Mac-0.1.3-{x64,arm64}.dmg`
- Windows: `AuroraRSSReader-Windows-0.1.3-x64-Setup.exe`
- Linux: `AuroraRSSReader-Linux-0.1.3-x64.AppImage`

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

## 📋 更新日志 | Changelog

### v0.1.3 (当前版本 | Current Version) 🎉
**打包修复与平台支持 | Packaging Fix & Platform Support**

#### 🔧 核心修复 | Core Fixes
- **Windows打包修复** - 彻底解决 PyInstaller 模块丢失问题 (pydantic, fastapi, etc.)
- **数据库初始化** - 修复首次运行时数据库表未创建导致的崩溃问题
- **依赖管理优化** - 自动收集所有 Python 子模块，确保打包完整性
- **启动流程优化** - 增加健康检查超时时间至 5 分钟，防止慢速系统误报超时

#### ✨ 新增功能 | New Features
- **一键已读** - 侧边栏新增"全部已读"按钮，快速清理未读消息
- **macOS Intel支持** - 新增对 x64 架构 Mac 的构建支持
- **深色模式优化** - 修复设置页面在深色模式下的文字颜色和背景显示问题

### v0.1.2 (历史版本 | Previous Version)
**重要Bug修复版本 | Critical Bug Fix Release**

#### 🐛 Bug修复 | Bug Fixes
- **时间过滤核心问题** - 修复"最近一天"等时间过滤完全失效的关键问题
- **分类显示Bug** - 修复点击分类后订阅列表不可见的问题
- **时区计算错误** - 解决RSS时间解析8小时偏差问题
- **依赖管理** - 修复缺失python-dateutil依赖导致的部署问题

#### ⚡ 功能增强 | Feature Enhancements
- **RSS解析引擎** - 集成dateutil库，解析成功率从~60%提升到83.3%+
- **学术期刊支持** - 支持Nature、ScienceDirect等期刊格式
- **RSSHub镜像** - 支持自定义镜像服务，提高网络访问稳定性
- **智能时间处理** - 未来时间使用导入时间，避免条目丢失

#### 🔧 技术优化 | Technical Improvements
- 新增`python-dateutil>=2.8.0`依赖
- 数据库清理和优化，清理1,793个历史条目
- 完善Git忽略规则，避免提交临时文件

### v0.1.0 (历史版本 | Previous Version)
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

## 📚 文档 | Documentation

- **[更新说明](UPDATE_README.md)** - v0.1.3详细更新内容
- **完整项目文档** - 旧版本文档已归档至 `docs_archive/` 目录

## ❓ 常见问题

### macOS 相关
**Q: macOS 上关闭窗口后，为什么从 dock 栏点击会报错？**
A: 这个问题已在 v0.1.0 版本中修复。如果仍有问题，请确保使用最新版本。

**Q: 如何在 macOS 上完全退出应用？**
A: 使用 `Cmd + Q` 快捷键或右键点击 dock 图标选择退出。

### 配置相关
**Q: 如何配置 AI 服务？**
A: 编辑 `backend/.env` 文件，添加相应的 API 密钥。

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
- [ ] **AI日报功能** - 智能生成每日热点新闻摘要和个性化推荐
- [ ] **播客支持** - 支持音频播客订阅和播放功能
- [ ] **阅读统计** - 个人阅读习惯分析和数据可视化

### 中期计划 (v0.3)
- [ ] **数据同步** - 跨设备数据同步和云备份
- [ ] **插件系统** - 支持第三方插件扩展功能

---

觉得有用就给个 ⭐ 吧！
