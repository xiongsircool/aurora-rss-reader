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

**Packaging Fix & Platform Support | 打包修复与平台支持**

- 🔧 **Fixed Windows Packaging** - Resolved PyInstaller dependency issues, backend now starts correctly
- 🍎 **macOS Intel Support** - Added support for older Intel-based Macs (x64)
- 📦 **Improved Build System** - All module dependencies now correctly included in packaged app
- 🗄️ **Database Initialization** - Fixed database table creation on first launch
- ⚡ **Startup Optimization** - Extended backend startup timeout for slower systems
- ✅ **One-Click Mark All Read** - Added batch mark all articles as read feature
- 🌙 **Dark Mode Fix** - Fixed settings page display issues in dark mode

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

### Overview
<div align="center">
  <img src="images/整体UI进行美化.png" alt="UI overview" style="width:88%;max-width:980px;border-radius:14px;box-shadow:0 6px 28px rgba(15,17,21,.18);" />
</div>

### Layout Modes
<div align="center">
  <figure style="display:inline-block;margin:0 12px 18px;text-align:center;vertical-align:bottom;">
    <img src="images/appimages/三栏式布局.png" alt="Three-column layout" style="width:440px;border-radius:12px;box-shadow:0 6px 24px rgba(15,17,21,.18);" />
    <figcaption>Three-column layout</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 12px 18px;text-align:center;vertical-align:bottom;">
    <img src="images/更新支持两栏模式优化阅读体验.png" alt="Two-column layout" style="width:380px;border-radius:12px;box-shadow:0 6px 24px rgba(15,17,21,.18);" />
    <figcaption>Two-column layout</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 12px 18px;text-align:center;vertical-align:bottom;">
    <img src="images/appimages/一拦式布局.png" alt="Single-column layout" style="width:220px;border-radius:12px;box-shadow:0 6px 24px rgba(15,17,21,.18);" />
    <figcaption>Single-column layout</figcaption>
  </figure>
</div>

### Single-column Interactions
<div align="center">
  <figure style="display:inline-block;margin:0 12px 18px;text-align:center;">
    <img src="images/优化一栏目交互逻辑/实现双击记录展示详情.png" alt="Double click to open details" style="width:320px;border-radius:12px;box-shadow:0 6px 24px rgba(15,17,21,.18);" />
    <figcaption>Double-click to open details</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 12px 18px;text-align:center;">
    <img src="images/优化一栏目交互逻辑/优化按键大小增加一个回到顶部.png" alt="Back to top button" style="width:320px;border-radius:12px;box-shadow:0 6px 24px rgba(15,17,21,.18);" />
    <figcaption>Back to top button</figcaption>
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
- Python 3.12+
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

### Development Setup (Manual)

#### Windows

1.  **Backend Setup**:
    ```powershell
    cd backend
    copy .env.example .env
    python -m venv .venv
    .\.venv\Scripts\pip install -r requirements.txt
    .\.venv\Scripts\pip install -e .
    .\.venv\Scripts\python -m scripts.migrate
    ```

2.  **Frontend Setup**:
    ```powershell
    cd rss-desktop
    copy .env.example .env
    pnpm install
    ```

3.  **Run Application**:
    ```powershell
    cd rss-desktop
    pnpm dev
    ```

#### Linux / macOS

You can use the `start.sh` script or follow these manual steps:

1.  **Backend Setup**:
    ```bash
    cd backend
    cp .env.example .env
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    pip install -e .
    python -m scripts.migrate
    ```

2.  **Frontend Setup**:
    ```bash
    cd rss-desktop
    cp .env.example .env
    pnpm install
    ```

3.  **Run Application**:
    ```bash
The startup script will automatically:
- Create Python virtual environment
- Install frontend and backend dependencies
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

### Configuration File
Edit `backend/.env` to configure AI and RSSHub:

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
- macOS: `AuroraRSSReader-Mac-0.1.3-{x64,arm64}.dmg`
- Windows: `AuroraRSSReader-Windows-0.1.3-x64-Setup.exe`
- Linux: `AuroraRSSReader-Linux-0.1.3-x64.AppImage`

## 📋 Documentation | 文档

- **[Update Details](UPDATE_README.md)** - Detailed v0.1.3 update content | v0.1.3详细更新内容
- **[Chinese Version](README_ZH.md)** - Complete documentation in Chinese | 中文完整文档

## Tech Stack

- **Frontend**: Vue 3 + Vite + Pinia + TypeScript
- **Backend**: FastAPI + SQLModel + SQLite
- **Desktop App**: Electron
- **Build Tools**: PyInstaller + electron-builder

## Project Structure

```
aurora-rss-reader/
├── rss-desktop/          # Frontend code
│   ├── src/             # Vue source code
│   └── electron/        # Electron main process
├── backend/             # Backend service
│   ├── app/            # FastAPI application
│   └── .venv/          # Python virtual environment
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
