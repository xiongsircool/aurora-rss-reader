# Aurora RSS Reader v0.1.0 🎉 | Aurora RSS Reader v0.1.0 首个稳定版本发布！

**First Stable Release | 首个稳定版本**

Aurora RSS Reader 是一个现代化的跨平台桌面 RSS 阅读器，集成了 AI 翻译和摘要功能。
A modern cross-platform desktop RSS reader with AI translation and summarization features.

---

## ✨ Main Features | 主要功能

### 🎨 Reading Experience | 阅读体验
- **Multi-layout Support | 多种布局模式** - Three-column and single-column layouts | 支持三栏式和一栏式布局
- **Group Management | 分组管理** - Organize RSS sources by categories | 将 RSS 源按分类整理
- **Full-text Search | 全文搜索** - Quick search in titles and content | 在标题和内容中快速查找
- **Favorites Feature | 收藏功能** - Bookmark important articles for later reading | 收藏重要文章便于后续阅读
- **Time Filtering | 时间过滤** - Filter articles by publish time | 按发布时间筛选文章

### 🤖 Smart Features | 智能功能
- **Article Summarization | 文章摘要** - Automatically generate article summaries | 自动生成文章要点
- **Multi-language Translation | 多语言翻译** - Translate full text and titles | 支持全文和标题翻译
- **Multi-language Interface | 多语言界面** - Chinese, English, Japanese, Korean support | 中文、英文、日语、韩语界面支持

### 🔧 System Features | 系统功能
- **Local Storage | 本地存储** - SQLite database, offline available | SQLite 数据库，离线可用
- **OPML Import/Export | OPML 导入导出** - Easy data migration | 方便数据迁移
- **Auto Refresh | 自动刷新** - Regularly fetch latest articles | 定时获取最新文章
- **Dark Mode | 深色模式** - Support for light and dark themes | 支持深色和浅色主题
- **Cross-platform Support | 跨平台支持** - Windows, macOS, Linux | Windows、macOS、Linux

---

## 📦 Downloads | 下载

### macOS
- **Intel Mac | Intel Mac**: `AuroraRSSReader-Mac-0.1.0-x64.dmg`
- **Apple Silicon | Apple Silicon**: `AuroraRSSReader-Mac-0.1.0-arm64.dmg`

### Windows
- **Installer | 安装版**: `AuroraRSSReader-Windows-0.1.0-x64-nsis.exe`
- **Portable | 便携版**: `AuroraRSSReader-Windows-0.1.0-x64-Portable.exe`

### Linux
- **AppImage**: `aurora-rss-reader-0.1.0.AppImage`
- **Debian**: `aurora-rss-reader_0.1.0_amd64.deb`

---

## 🛠️ Installation | 安装说明

### macOS
1. Download the corresponding `.dmg` file | 下载对应架构的 `.dmg` 文件
2. Double-click to open and drag the app to Applications folder | 双击打开，将应用拖拽到 Applications 文件夹
3. First run may require allowing in System Preferences | 首次运行可能需要在系统偏好设置中允许运行

### Windows
1. Download the `.exe` installer | 下载 `.exe` 安装程序
2. Right-click and "Run as administrator" | 右键选择"以管理员身份运行"
3. Follow the installation wizard | 按照安装向导完成安装

### Linux
1. Download the `.AppImage` file | 下载 `.AppImage` 文件
2. Add execute permission | 添加执行权限：`chmod +x aurora-rss-reader-0.1.0.AppImage`
3. Double-click to run or execute in terminal | 双击运行或命令行执行

---

## 🔧 Configuration | 配置

Edit `backend/.env` file to configure AI services | 编辑 `backend/.env` 文件配置 AI 服务：

```env
# RSSHub
RSSHUB_BASE=https://rsshub.app

# AI Configuration | AI 配置
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4/
GLM_MODEL=glm-4-flash
GLM_API_KEY=your_api_key_here
```

---

## 📋 System Requirements | 系统要求

- **macOS**: 10.14 or higher | 10.14 或更高版本
- **Windows**: Windows 10 or higher | Windows 10 或更高版本
- **Linux**: Ubuntu 18.04 or equivalent | Ubuntu 18.04 或同等版本

---

## 🐛 Known Issues | 已知问题

- First startup may take longer to initialize database | 首次启动可能需要较长时间初始化数据库
- Some firewalls may require manual network access permission | 某些防火墙可能需要手动允许网络访问

---

## 🙏 Acknowledgments | 致谢

Thanks to all testing users for feedback and suggestions! | 感谢所有测试用户的反馈和建议！

---

**Documentation | 完整文档**: https://github.com/xiongsircool/aurora-rss-reader/tree/main/docs
**Issue Tracker | 问题反馈**: https://github.com/xiongsircool/aurora-rss-reader/issues
**Discussions | 讨论区**: https://github.com/xiongsircool/aurora-rss-reader/discussions

---

## 🎯 Roadmap | 未来规划

### v0.2.0
- [ ] Mobile support | 移动端支持 (iOS, Android)
- [ ] AI daily briefing | AI 日报功能
- [ ] Podcast support | 播客支持
- [ ] Reading statistics | 阅读统计

### v0.3.0
- [ ] Cloud sync | 云同步
- [ ] Plugin system | 插件系统

---

**Happy Reading! 📚 | 祝您阅读愉快！ 📚**