# Aurora 隐私政策 / Privacy Policy

> 适用产品：Aurora RSS Reader（桌面版）、Aurora Mobile（iOS / Android）
> 本文档的公开链接：https://github.com/xiongsircool/aurora-rss-reader/blob/main/docs/PRIVACY.md

---

## 中文

**最后更新：2026 年 10 月**

Aurora 是一款本地优先（local-first）的 RSS 阅读器。我们坚持一个简单原则：**你的数据属于你，全部保存在你的设备上。**

### 我们不收集任何数据

- **无账号系统**：Aurora 不需要注册、登录，不关联你的任何身份信息。
- **无遥测**：应用内不包含任何分析 SDK、广告追踪、崩溃收集或用户行为统计代码。
- **无服务器**：我们不运营任何存储用户内容的服务器。订阅、文章、阅读记录、收藏、播客进度、AI 设置等所有数据均仅保存在你的设备本地数据库中。

### 网络请求说明

Aurora 只在以下场景发起网络请求，且均为**设备直连**：

1. **抓取订阅源**：应用直接向你订阅的网站地址请求 RSS/Atom 内容。
2. **网页全文提取**：阅读时直接向原文网站请求页面。
3. **站点图标获取**：向订阅源站点或 DuckDuckGo 图标服务请求 favicon。
4. **AI 功能（可选）**：文章摘要与翻译功能使用**你自己提供的 API Key**（如 DeepSeek、SiliconFlow）。Key 保存在设备本地安全存储中，请求由设备直接发送至对应服务商。我们无法接触你的 Key、你的请求内容或返回结果。

以上请求不经过我们的任何中间服务器——因为根本没有。

### 权限使用说明

- **通知**：仅用于后台刷新完成后提醒新文章，完全在本地触发。
- **照片（添加权限）**：仅在你主动点"保存图片"时使用。

### 数据的删除与迁移

- 卸载应用即删除全部本地数据，无残留。
- 订阅列表可通过 OPML 导出/导入，随时迁移到其他阅读器。

### 开源与可验证

Aurora 采用 GPL-3.0 开源，全部代码可公开审计：https://github.com/xiongsircool/aurora-rss-reader

### 联系我们

如有疑问请通过 GitHub Issues 联系：https://github.com/xiongsircool/aurora-rss-reader/issues

---

## English

**Last updated: October 2026**

Aurora is a local-first RSS reader built on one simple principle: **your data belongs to you and stays on your device.**

### We collect nothing

- **No accounts**: no sign-up, no login, no identity attached.
- **No telemetry**: no analytics SDKs, no ad tracking, no crash reporting, no behavioral statistics.
- **No servers**: we operate no servers that store user content. Subscriptions, articles, read states, favorites, podcast progress, and AI settings live solely in your device's local database.

### Network requests

Aurora makes direct connections only in these cases:

1. **Feed fetching** — straight to the websites you subscribe to.
2. **Full-text extraction** — straight to the original article's site.
3. **Favicon resolution** — the feed's site or DuckDuckGo's icon service.
4. **AI features (optional)** — summaries and translations use **your own API key** (e.g. DeepSeek, SiliconFlow). The key is stored in on-device secure storage; requests go directly from your device to the provider. We never see your key, prompts, or results.

None of these requests pass through any server of ours — none exists.

### Permissions

- **Notifications**: local-only reminders after background refresh finds new articles.
- **Photo library (add-only)**: used only when you explicitly choose "Save Image".

### Deletion & migration

- Uninstalling the app deletes all local data.
- Subscriptions can be exported/imported via OPML at any time.

### Open source

Aurora is GPL-3.0 licensed and fully auditable: https://github.com/xiongsircool/aurora-rss-reader

### Contact

Questions? Open an issue: https://github.com/xiongsircool/aurora-rss-reader/issues
