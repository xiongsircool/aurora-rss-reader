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

## 🚧 v0.1.9 Release Candidate | 预发布版本

**Background Summary Queue, Modernized MCP & Deployment Polish | 后台摘要队列、MCP 现代化与部署完善**

- 🤖 **Background Summary Queue** - Unread articles can now enter a saved local summary queue and reuse generated summaries after restart
- 📊 **Runtime Status Panel** - Added live queue status in settings so you can inspect queued, running, succeeded and failed summary jobs
- 🔌 **Modernized MCP Surface** - Reworked MCP into split resource tools, added AI/tag/digest workflows, and moved MCP into its own settings section
- 📚 **MCP Usability Upgrade** - Recommended tools are grouped, legacy aliases are marked for removal, and search now supports cursor pagination
- 🕒 **Time Semantics Aligned** - MCP list/search defaults now follow the app's current `date_range + time_field` settings
- 🐳 **Docker Backend Port Exposure** - Local Docker deployment now exposes the backend directly on `15432`, including `/api` and `/mcp`

---

## Introduction

Aurora RSS Reader is a cross-platform desktop RSS reader integrated with AI translation and summarization features. It supports multiple layout modes, local data storage, and rich customization options.

**Current Version: v0.1.9**

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

### Current UI Highlights
<div align="center">
  <figure style="display:inline-block;margin:0 12px 18px;text-align:center;vertical-align:bottom;">
    <img src="images/v.0.1.8/MCP功能升级.png" alt="Dedicated MCP settings" style="width:440px;border-radius:12px;box-shadow:0 6px 24px rgba(15,17,21,.18);" />
    <figcaption>Dedicated MCP Settings</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 12px 18px;text-align:center;vertical-align:bottom;">
    <img src="images/v.0.1.8/增强了摘要和翻译分开设置偏好.png" alt="Summary and translation preferences" style="width:440px;border-radius:12px;box-shadow:0 6px 24px rgba(15,17,21,.18);" />
    <figcaption>Summary & Translation Preferences</figcaption>
  </figure>
</div>

<div align="center">
  <figure style="display:inline-block;margin:0 12px 18px;text-align:center;vertical-align:bottom;">
    <img src="images/v.0.1.8/支持单个订阅和分组的日报功能.png" alt="Scope summary and digest" style="width:280px;border-radius:12px;box-shadow:0 6px 24px rgba(15,17,21,.18);" />
    <figcaption>Scope Summary & Digest</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 12px 18px;text-align:center;vertical-align:bottom;">
    <img src="images/v.0.1.8/支持代理网络的配置.png" alt="Proxy configuration" style="width:280px;border-radius:12px;box-shadow:0 6px 24px rgba(15,17,21,.18);" />
    <figcaption>Proxy Configuration</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 12px 18px;text-align:center;vertical-align:bottom;">
    <img src="images/v.0.1.8/AI摘要支持makedown渲染.png" alt="Markdown summary rendering" style="width:280px;border-radius:12px;box-shadow:0 6px 24px rgba(15,17,21,.18);" />
    <figcaption>Markdown Summary Rendering</figcaption>
  </figure>
</div>

### Media Feed Support
<div align="center">
  <figure style="display:inline-block;margin:0 12px 18px;text-align:center;vertical-align:bottom;">
    <img src="images/v0.1.6/视频订阅显示增强.png" alt="Video feed display" style="width:440px;border-radius:12px;box-shadow:0 6px 24px rgba(15,17,21,.18);" />
    <figcaption>Video Feed Display</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 12px 18px;text-align:center;vertical-align:bottom;">
    <img src="images/v0.1.6/图像订阅显示增强.png" alt="Image feed display" style="width:440px;border-radius:12px;box-shadow:0 6px 24px rgba(15,17,21,.18);" />
    <figcaption>Image Feed Display</figcaption>
  </figure>
</div>

### Blog & Article Enhancement
<div align="center">
  <img src="images/v0.1.6/博客订阅增强.png" alt="Blog feed enhancement" style="width:88%;max-width:980px;border-radius:14px;box-shadow:0 6px 28px rgba(15,17,21,.18);" />
</div>

### Context Menu & Collections
<div align="center">
  <figure style="display:inline-block;margin:0 12px 18px;text-align:center;">
    <img src="images/v0.1.6/右键功能增强feeds.png" alt="Feed context menu" style="width:320px;border-radius:12px;box-shadow:0 6px 24px rgba(15,17,21,.18);" />
    <figcaption>Feed Context Menu</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 12px 18px;text-align:center;">
    <img src="images/v0.1.6/右键将订阅记录添加到书签组.png" alt="Add to collection" style="width:320px;border-radius:12px;box-shadow:0 6px 24px rgba(15,17,21,.18);" />
    <figcaption>Add to Collection</figcaption>
  </figure>
</div>

### MCP Status Display
<div align="center">
  <img src="images/v0.1.6/MCP服务显性检测.png" alt="MCP status indicator" style="width:320px;border-radius:12px;box-shadow:0 6px 24px rgba(15,17,21,.18);" />
</div>

### Zotero Integration
<div align="center">
  <img src="images/v0.1.6/发送到zotero支持.png" alt="Send to Zotero" style="width:88%;max-width:980px;border-radius:14px;box-shadow:0 6px 28px rgba(15,17,21,.18);" />
</div>

### Workspace Advanced Search
<div align="center">
  <img src="images/v0.1.6/工作区域高级检索标签组.png" alt="Workspace advanced search" style="width:88%;max-width:980px;border-radius:14px;box-shadow:0 6px 28px rgba(15,17,21,.18);" />
</div>

## Quick Start

### System Requirements
- Node.js 22
- pnpm 8+

### Installation and Running
```bash
# Clone the repository
git clone https://github.com/xiongsircool/aurora-rss-reader.git
cd aurora-rss-reader

# Recommended: Node.js backend
cd backend-node
npm install
cd ../rss-desktop
pnpm install
pnpm dev

# Quick start (Node.js backend)
cd ..
chmod +x start.sh
./start.sh
```

### Development Setup (Manual)
Recommended (backend-node):
- `cd backend-node && npm install`
- `cd rss-desktop && pnpm install`
- `pnpm dev` (from `rss-desktop`)

### Troubleshooting
### macOS Compatibility
**Initial Setup:**
1. **Download the `.zip` version** if the `.dmg` fails to mount (common on some systems for unsigned apps).
2. Unzip and drag `Aurora RSS Reader.app` to your Applications folder.
3. If you see **"App is damaged and can't be opened"** (or "cannot open"):
   - This is normal for unsigned open-source apps on macOS.
   - Open Terminal and run:
     ```bash
     sudo xattr -rd com.apple.quarantine /Applications/AuroraRSSReader.app
     ```
   - Then open the app again.

### Performance
**Q: The app is slow to start?**
A: Check the backend service logs if possible. First launch may take longer to initialize the database.
- Initialize database
- Launch Electron application

### Access URLs
- **Desktop App**: Electron window opens automatically
- **Web Interface**: http://localhost:5173
- **API Service**: http://127.0.0.1:15432

### Configuration
Set environment variables for the Node.js backend to configure AI and RSSHub:

```env
# RSSHub
RSSHUB_BASE_URL=https://rsshub.app

# AI Configuration
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4/
GLM_MODEL=glm-4-flash
GLM_API_KEY=your_api_key_here
```

## 🐳 Docker Deployment

```bash
# Quick start with Docker Compose
git clone https://github.com/xiongsircool/aurora-rss-reader.git
cd aurora-rss-reader
docker-compose up -d

# Access Web UI: http://localhost:8080
# Access Backend API: http://localhost:15432/api
# Access MCP Endpoint: http://localhost:15432/mcp
```

For detailed Docker configuration, see [Docker README](docker/README.md).

> **Note**: Docker image only supports `linux/amd64` architecture.

## Build and Release

```bash
# Build installation package
chmod +x build-release-app.sh
./build-release-app.sh
```

Generated files:
- macOS: `AuroraRSSReader-Mac-0.1.9.dmg`
- Windows: `AuroraRSSReader-Windows-0.1.9-x64-Setup.exe`
- Linux: `AuroraRSSReader-Linux-0.1.9-x64.AppImage`

### Public Packaging Notes
- Bump `rss-desktop/package.json` to the target release version before any public packaging or tagging.
- Run the packaging preflight on `main` first with `workflow_dispatch`; this validates the build without creating a GitHub Release.
- Only create the public tag after macOS, Windows, and Linux builds all pass.
- Use a fresh tag such as `v0.1.9`; do not reuse an occupied release tag like `v0.1.8`.
- Auto-update continues to work only after the public GitHub Release is created with installers and `latest*.yml`.

## 📋 Documentation | 文档

- **[Chinese Version](README_ZH.md)** - Complete documentation in Chinese | 中文完整文档

## Tech Stack

- **Frontend**: Vue 3 + Vite + Pinia + TypeScript
- **Backend**: Fastify + TypeScript + SQLite
- **Desktop App**: Electron
- **Build Tools**: electron-builder

## Project Structure

```
aurora-rss-reader/
├── rss-desktop/          # Frontend code
│   ├── src/             # Vue source code
│   └── electron/        # Electron main process
├── backend-node/        # Node.js backend (Fastify)
├── images/              # Image resources
└── start.sh            # Startup script
```

## Support

- **Issue Reporting**: [GitHub Issues](https://github.com/xiongsircool/aurora-rss-reader/issues)
- **Feature Suggestions**: [GitHub Discussions](https://github.com/xiongsircool/aurora-rss-reader/discussions)
- **Email Contact**: 1666526339@qq.com

## License

This project uses [GNU General Public License v3.0](LICENSE), which is a copyleft open source license requiring derivative works to also be open source.

---

## 🎯 Future Roadmap

### Short-term Plans (v0.2)
- [x] **AI Daily Briefing / Scope Summary** - Tag digest, feed/group scope summaries, automation and rerun flows are already available ✅
- [x] **Podcast Support** - Support for audio podcast subscription and playback ✅
- [ ] **Reading Analytics** - Personal reading habits analysis and data visualization
- [x] **RSSHub Support** - RSSHub URL configuration, mirror switching and RSSHub feed access are already supported ✅
- [ ] **Browser Extension** - Use AI to analyze sites and generate RSSHub subscription rules

### Mid-term Plans (v0.3)
- [ ] **Data Synchronization** - Cross-device data sync and cloud backup
- [ ] **Plugin System** - Support for third-party plugin extensions

---

Give it a ⭐ if you find it useful!
## Changelog

### v0.1.9 (Release Candidate)
**Background Summary Queue + MCP Modernization + Docker Access**

- Background summary queue can persist generated summaries locally and reuse them after restart
- Added queue runtime status panel in settings for live inspection of summary jobs
- MCP moved out of AI provider config into a dedicated settings section
- MCP tool surface modernized with grouped recommended tools, deprecation hints and cursor-based search pagination
- MCP time defaults now follow the app's current date range and time field settings
- Docker deployment now exposes the backend directly on `15432` for local `/api` and `/mcp` access

### v0.1.8 (Previous Version)
**Published release baseline before the current packaging cycle**

### v0.1.7
**Digest Intelligence, Tag Workflow Polish & Update Experience**

- Digest 2.0 with history, manual regenerate and locale-aligned language
- Latest + Week digest modes
- Analyze-all full pagination fix
- Summary prompting quality upgrade
- Manual update-check entry in settings

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=xiongsircool/aurora-rss-reader&type=Date)](https://www.star-history.com/#xiongsircool/aurora-rss-reader&Date)
