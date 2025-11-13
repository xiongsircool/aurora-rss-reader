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

Aurora RSS Reader 是一个跨平台桌面 RSS 阅读器，集成了 AI 翻译和摘要功能。支持多种布局模式，本地数据存储，以及丰富的自定义选项。

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

### 界面预览

#### 布局模式
<div align="center">
  <figure style="display:inline-block;margin:0 16px 18px;text-align:center;vertical-align:top;">
    <img src="images/appimages/三栏式布局.png" alt="三栏式布局" style="width:480px;border-radius:14px;box-shadow:0 6px 30px rgba(15,17,21,.18);" />
    <figcaption style="margin-top:12px;font-size:14px;color:#666;">三栏式布局</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 16px 18px;text-align:center;vertical-align:top;">
    <img src="images/appimages/一拦式布局.png" alt="一栏式布局" style="width:220px;border-radius:14px;box-shadow:0 6px 30px rgba(15,17,21,.18);" />
    <figcaption style="margin-top:12px;font-size:14px;color:#666;">一栏式布局</figcaption>
  </figure>
</div>

#### 多语言支持
<div align="center">
  <figure style="display:inline-block;margin:0 8px 16px;text-align:center;vertical-align:top;">
    <img src="images/appimages/多语言支持中文.png" alt="中文界面" style="width:220px;border-radius:12px;box-shadow:0 4px 20px rgba(15,17,21,.1);" />
    <figcaption style="margin-top:8px;font-size:13px;color:#666;">中文</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 8px 16px;text-align:center;vertical-align:top;">
    <img src="images/appimages/多语言支持英文.png" alt="English Interface" style="width:220px;border-radius:12px;box-shadow:0 4px 20px rgba(15,17,21,.1);" />
    <figcaption style="margin-top:8px;font-size:13px;color:#666;">English</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 8px 16px;text-align:center;vertical-align:top;">
    <img src="images/appimages/多语言支持日语.png" alt="日本語" style="width:220px;border-radius:12px;box-shadow:0 4px 20px rgba(15,17,21,.1);" />
    <figcaption style="margin-top:8px;font-size:13px;color:#666;">日本語</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 8px 16px;text-align:center;vertical-align:top;">
    <img src="images/appimages/多语言支持韩文.png" alt="한국어" style="width:220px;border-radius:12px;box-shadow:0 4px 20px rgba(15,17,21,.1);" />
    <figcaption style="margin-top:8px;font-size:13px;color:#666;">한국어</figcaption>
  </figure>
</div>

#### 管理功能
<div align="center">
  <figure style="display:inline-block;margin:0 12px 20px;text-align:center;vertical-align:top;">
    <img src="images/appimages/支持订阅分组.png" alt="分组管理" style="width:320px;border-radius:12px;box-shadow:0 4px 20px rgba(15,17,21,.1);" />
    <figcaption style="margin-top:10px;font-size:13px;color:#666;">订阅源分组</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 12px 20px;text-align:center;vertical-align:top;">
    <img src="images/appimages/支持订阅信息时间过滤设定.png" alt="时间过滤" style="width:320px;border-radius:12px;box-shadow:0 4px 20px rgba(15,17,21,.1);" />
    <figcaption style="margin-top:10px;font-size:13px;color:#666;">时间过滤</figcaption>
  </figure>
  <figure style="display:inline-block;margin:0 12px 20px;text-align:center;vertical-align:top;">
    <img src="images/appimages/支持特定内容收藏.png" alt="收藏功能" style="width:320px;border-radius:12px;box-shadow:0 4px 20px rgba(15,17,21,.1);" />
    <figcaption style="margin-top:10px;font-size:13px;color:#666;">收藏功能</figcaption>
  </figure>
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

## 📚 文档

- **[完整文档](docs/README.md)** - 所有文档的入口
- **[RSSHub 配置](docs/guides/RSSHUB_CONFIG_GUIDE.md)** - 自定义 RSSHub 实例
- **[RSSHub 故障排除](docs/guides/RSSHUB_TROUBLESHOOTING.md)** - 连接问题排查
- **[开发指南](docs/development/CONTRIBUTING.md)** - 贡献代码和开发设置
- **[后端文档](docs/development/backend.md)** - 后端架构和 API
- **[构建文档](docs/development/build.md)** - 构建和部署说明
- **[更新日志](docs/CHANGELOG.md)** - 版本更新记录

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
