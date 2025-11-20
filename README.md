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
  <a href="README_ZH.md">🇨🇳 中文</a> • <a href="README.md">🇺🇸 English</a>
</p>

<div align="center">
  <img alt="Aurora RSS Reader" src="images/带版本号和软件名图标.png" height="120" />
</div>

## 🎉 v0.1.3 Latest Release | 最新版本

**Major Performance & Feature Update | 性能与功能重大更新**

- 🦀 **Rust Backend** - Fully migrated to Rust backend for superior performance and memory efficiency
- 📖 **Reading Mode** - Added immersive reading mode (experimental support for anti-crawl sites)
- ⏰ **Enhanced Time Filtering** - Added 2-day and 3-day filter options for better content management
- 🌐 **Translation Options** - Added title translation display mode settings
- ⚡ **Concurrency Control** - Added concurrency limits for translation tasks to prevent API throttling

---

## Introduction

Aurora RSS Reader is a cross-platform desktop RSS reader integrated with AI translation and summarization features. It supports multiple layout modes, local data storage, and rich customization options.

**Current Version: v0.1.3**

## Key Features

### Reading Experience
- **Multiple Layout Modes** - Support for three-column and single-column layouts
- **Group Management** - Organize RSS feeds by categories
- **Full-text Search** - Quick search in titles and content
- **Favorites Feature** - Bookmark important articles for later reading
- **Time Filtering** - Filter articles by publication date

### Smart Features
- **Article Summaries** - Automatically generate key points for quick understanding
- **Multi-language Translation** - Support full-text and title translation for barrier-free reading
- **Multi-language Interface** - Chinese, English, Japanese, Korean interface support
- **Flexible Configuration** - Support multiple translation and summarization services

### System Features
- **Local Storage** - SQLite database, offline available
- **OPML Import/Export** - Easy data migration
- **Auto Refresh** - Periodically fetch latest articles
- **Dark Mode** - Support dark and light themes
- **RSSHub Support** - Extend RSS feed coverage

## Interface Preview

### Layout Modes
<div align="center">
  <figure style="display:inline-block;margin:0 16px 18px;text-align:center;vertical-align:bottom;">
    <img src="images/appimages/三栏式布局.png" alt="Three-column layout" style="width:520px;border-radius:14px;box-shadow:0 6px 30px rgba(15,17,21,.18);" />
    <figcaption>Three-column layout</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 16px 18px;text-align:center;vertical-align:bottom;">
    <img src="images/appimages/一拦式布局.png" alt="Single-column layout" style="width:240px;border-radius:14px;box-shadow:0 6px 30px rgba(15,17,21,.18);" />
    <figcaption>Single-column layout</figcaption>
  </figure>
</div>

### Multi-language Experience
<div align="center">
  <figure style="display:inline-block;margin:0 16px 18px;text-align:center;">
    <img src="images/appimages/多语言支持中文.png" alt="Chinese Interface" style="width:360px;border-radius:14px;box-shadow:0 6px 30px rgba(15,17,21,.18);" />
    <figcaption>Chinese Interface</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 16px 18px;text-align:center;">
    <img src="images/appimages/多语言支持英文.png" alt="English Interface" style="width:360px;border-radius:14px;box-shadow:0 6px 30px rgba(15,17,21,.18);" />
    <figcaption>English Interface</figcaption>
  </figure>
</div>

### Management Features
<div align="center">
  <figure style="display:inline-block;margin:0 16px 18px;text-align:center;">
    <img src="images/appimages/支持订阅分组.png" alt="Group Management" style="width:360px;border-radius:14px;box-shadow:0 6px 30px rgba(15,17,21,.18);" />
    <figcaption>Subscription grouping</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 16px 18px;text-align:center;">
    <img src="images/appimages/支持订阅信息时间过滤设定.png" alt="Time Filtering" style="width:360px;border-radius:14px;box-shadow:0 6px 30px rgba(15,17,21,.18);" />
    <figcaption>Time filtering</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 16px 18px;text-align:center;">
    <img src="images/appimages/支持特定内容收藏.png" alt="Favorites" style="width:360px;border-radius:14px;box-shadow:0 6px 30px rgba(15,17,21,.18);" />
    <figcaption>Favorites feature</figcaption>
  </figure>
</div>

### Multi-language Interface
<div align="center">
  <figure style="display:inline-block;margin:0 12px 16px;text-align:center;">
    <img src="images/appimages/多语言支持中文.png" alt="Chinese" style="width:200px;border-radius:12px;box-shadow:0 4px 20px rgba(15,17,21,.1);" />
    <figcaption>Chinese</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 12px 16px;text-align:center;">
    <img src="images/appimages/多语言支持英文.png" alt="English" style="width:200px;border-radius:12px;box-shadow:0 4px 20px rgba(15,17,21,.1);" />
    <figcaption>English</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 12px 16px;text-align:center;">
    <img src="images/appimages/多语言支持日语.png" alt="Japanese" style="width:200px;border-radius:12px;box-shadow:0 4px 20px rgba(15,17,21,.1);" />
    <figcaption>Japanese</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 12px 16px;text-align:center;">
    <img src="images/appimages/多语言支持韩文.png" alt="Korean" style="width:200px;border-radius:12px;box-shadow:0 4px 20px rgba(15,17,21,.1);" />
    <figcaption>Korean</figcaption>
  </figure>
</div>

## Quick Start

### System Requirements
- Node.js 18+
- Rust 1.70+ (with Cargo)
- pnpm 8+

### Installation and Running
```bash
# Clone the repository
git clone https://github.com/xiongsircool/aurora-rss-reader.git
cd aurora-rss-reader

# One-click startup
chmod +x start.sh
./start.sh
```

The startup script will automatically:
- Build Rust backend in development mode
- Install frontend dependencies
- Initialize database
- Launch Electron application

### Access URLs
- **Desktop App**: Electron window opens automatically
- **Web Interface**: http://localhost:5173
- **API Service**: http://127.0.0.1:15432

### Configuration File
Edit `rust-backend/.env` to configure AI and RSSHub:

```env
# RSSHub
RSSHUB_BASE=https://rsshub.app

# AI Configuration
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4/
GLM_MODEL=glm-4-flash
GLM_API_KEY=your_api_key_here
```

## Build and Release

```bash
# Build installation package
chmod +x build-release-app.sh
./build-release-app.sh
```

Generated files:
- macOS: `Aurora RSS Reader-Mac-0.1.3-{x64,arm64}.dmg`
- Windows: `Aurora RSS Reader-Setup-0.1.3.exe`
- Linux: `aurora-rss-reader-0.1.3.AppImage`

## 📋 Documentation | 文档

- **[Update Details](UPDATE_README.md)** - Detailed v0.1.3 update content | v0.1.3详细更新内容
- **[Chinese Version](README_ZH.md)** - Complete documentation in Chinese | 中文完整文档

## Tech Stack

- **Frontend**: Vue 3 + Vite + Pinia + TypeScript
- **Backend**: Rust + Axum + SeaORM + SQLite
- **Desktop App**: Electron
- **Build Tools**: Cargo + electron-builder

## Project Structure

```
aurora-rss-reader/
├── rss-desktop/          # Frontend code
│   ├── src/             # Vue source code
│   └── electron/        # Electron main process
├── rust-backend/        # Rust backend service
│   ├── src/            # Rust source code
│   └── Cargo.toml      # Rust dependencies
├── images/              # Image resources
└── start.sh            # Startup script
```

## 📋 Documentation | 文档

- **[Update Details](UPDATE_README.md)** - Detailed v0.1.3 update content | v0.1.3详细更新内容
- **[Chinese Version](README_ZH.md)** - Complete documentation in Chinese | 中文完整文档

## Support

- **Issue Reporting**: [GitHub Issues](https://github.com/xiongsircool/aurora-rss-reader/issues)
- **Feature Suggestions**: [GitHub Discussions](https://github.com/xiongsircool/aurora-rss-reader/discussions)
- **Email Contact**: 1666526339@qq.com

## License

This project uses [GNU General Public License v3.0](LICENSE), which is a copyleft open source license requiring derivative works to also be open source.

---

## 🎯 Future Roadmap

### Short-term Plans (v0.2)
- [ ] **Mobile Support** - Develop iOS and Android mobile applications
- [ ] **AI Daily Briefing** - Smart daily news summaries and personalized recommendations
- [ ] **Podcast Support** - Support for audio podcast subscription and playback
- [ ] **Reading Analytics** - Personal reading habits analysis and data visualization

### Mid-term Plans (v0.3)
- [ ] **Data Synchronization** - Cross-device data sync and cloud backup
- [ ] **Plugin System** - Support for third-party plugin extensions

---

Give it a ⭐ if you find it useful!