# Flutter 移动端 M0 技术验证计划

> 状态:进行中 · 开始于 2026-09-02
> 目标:在开发完整 UI 前,证明 Android/iOS 端上抓取、解析、SQLite、全文提取、AI 和后台任务可行。

## 0. 当前环境

- [x] v0.2.0 桌面版已推送并触发发布流水线
- [x] 旧 Capacitor 客户端归档到 `archive/mobile-plan-d-v1`
- [x] 创建开发分支 `feature/mobile-flutter-v1`
- [ ] 安装 Flutter stable SDK
- [ ] 安装完整 Xcode并完成首次启动/许可证
- [ ] 安装 Android Studio、Android SDK与 JDK 17+
- [ ] `flutter doctor -v` 的 Android/iOS 项全部通过

环境限制不阻塞纯 Dart 单测和项目分层,但 M0 不能在真机检查完成前宣布结束。

## 1. 脚手架

- [ ] 使用 `flutter create --platforms=android,ios` 创建 `rss-mobile/`
- [ ] 应用标识统一为 `com.xiongsircool.aurora.mobile`
- [ ] 建立 `app/domain/application/data/platform/features/shared` 目录
- [ ] 配置静态检查、单测和集成测试
- [ ] 增加开发/测试环境配置,禁止真实凭据进入仓库

验收:

```bash
flutter analyze
flutter test
flutter build apk --debug
flutter build ios --debug --no-codesign
```

## 2. HTTP 与编码

验证项:

- [ ] 原始字节响应,不提前假设 UTF-8
- [ ] gzip/deflate
- [ ] 301/302/307/308 重定向
- [ ] 超时和主动取消
- [ ] User-Agent与常用请求头
- [ ] UTF-8、GBK/GB18030、Big5、Shift-JIS 编码
- [ ] TLS、HTTP 错误和响应体大小限制

验收:至少 20 个真实 Feed 形成固定清单;失败必须返回结构化错误且不覆盖本地旧内容。

## 3. Feed 解析与归一化

覆盖:

- [ ] RSS 2.0
- [ ] Atom
- [ ] Media RSS
- [ ] Podcast enclosure
- [ ] HTML description/content
- [ ] 缺 guid、缺日期、重复 guid
- [ ] 时区和 Unix timestamp
- [ ] 图片、视频、DOI、PMID

旧 Node `feedNormalizer.test.ts` 的输入输出将转成跨端测试语料。解析层必须是纯 Dart,不得依赖 Widget。

## 4. SQLite 与性能

最小表:

```text
feeds
entries
summaries
translations
user_settings
user_tags
entry_tags
collections
collection_entries
schema_migrations
```

验证:

- [ ] 首次建库和版本迁移
- [ ] Feed + guid 唯一去重
- [ ] 50,000 篇文章批量灌入
- [ ] 收件箱游标分页
- [ ] 已读、收藏、标签事务
- [ ] 标题/正文关键字搜索
- [ ] 删除 Feed 后关联数据清理

初始性能门槛(在选定的中低端 Android 真机上复测):

- 冷库打开到首批 50 条查询完成:< 500ms
- 50,000 条数据的游标分页查询:< 100ms
- 单次写入 200 条归一化文章:< 500ms
- 滚动期间不执行大型同步 SQL

## 5. 全文与 AI

- [ ] 端上抓取文章 HTML
- [ ] 正文提取和清洗
- [ ] 原文失败时回退 Feed 内容
- [ ] OpenAI 兼容 `/chat/completions`
- [ ] 流式输出、取消、超时和重试
- [ ] API Key进入系统安全存储
- [ ] 摘要/翻译按 entry + language 缓存

验收:没有 Key 时阅读功能完整可用;AI 失败不影响文章状态和正文。

## 6. 后台任务

- [ ] Android 后台刷新验证
- [ ] iOS BGTask限制验证
- [ ] 前后台复用同一刷新用例
- [ ] 网络、低电量和系统调度限制
- [ ] 通知权限与刷新权限分离

首版允许系统延迟执行,不承诺精确到分钟的刷新周期。

## 7. M0 退出条件

以下全部满足才进入 M1:

- [ ] Android 与 iOS 真机至少各跑通一次抓取闭环
- [ ] 20 个 Feed 测试清单有结果报告
- [ ] 50,000 条 SQLite 基准有可复现报告
- [ ] 数据库迁移和解析测试全绿
- [ ] 已记录平台差异与不可行项
- [ ] 确认依赖许可可用于 GPLv3 项目

## 8. M1 预告

M1 只实现本地阅读闭环:订阅 CRUD、OPML、刷新、混合收件箱、阅读、已读、收藏、分页和搜索。AI、自托管连接和完整视觉打磨不进入 M1。
