# ADR 0001:移动端采用 Flutter 本地优先架构

- 状态:Accepted
- 日期:2026-09-02
- 分支:`feature/mobile-flutter-v1`
- 关联:issue #13、#16

## 背景

Aurora 的移动端需要在没有桌面电脑、局域网后端或官方云服务时保持完整可用。近期目标平台为 Android 与 iOS,鸿蒙为后续平台。核心能力包括 RSS/Atom 抓取和解析、SQLite 本地存储、全文提取、媒体展示、AI 摘要与翻译、后台刷新。

上一版 Vue 3 + Capacitor 实现已经归档到 `archive/mobile-plan-d-v1`。该实现不再作为新客户端基础,但其设计稿、Feed 测试场景和领域逻辑测试可作为参考。

## 决策

### 1. Android/iOS 使用 Flutter

Flutter 负责 Android/iOS 的 UI 和应用层。网络、解析、数据库和 AI 请求全部运行在设备上,不依赖 WebView 承担核心业务,也不要求后端在线。

### 2. 本地模式是默认且完整的产品

首次启动不要求登录或配置服务器。用户可以在本地完成:

- 添加、编辑、删除和分组订阅;
- 抓取与解析 RSS 2.0、Atom、Media RSS;
- 阅读、搜索、已读、收藏、标签和 OPML 导入导出;
- 配置自己的 OpenAI 兼容服务并在端上生成摘要/翻译。

### 3. 自托管是可选适配器

现有 `/api/mobile` 作为未来可选连接方式保留。自托管模式不能侵入本地域模型,也不能成为 App 启动前提。

第一版只预留接口:

```text
ContentSource
├── LocalContentSource       # 默认,端上抓取和 SQLite
└── SelfHostedContentSource  # 后续,连接 /api/mobile
```

双向同步和冲突解决不属于首版范围。

### 4. 鸿蒙不阻塞 Android/iOS

Flutter 官方目标平台目前不包含 HarmonyOS。鸿蒙版本等 Android/iOS 数据模型和行为稳定后再决策:

1. 评估当时 Flutter/OpenHarmony 移植成熟度;
2. 验证 ArkUI-X 的关键插件能力;
3. 若跨端方案不可靠,使用 ArkTS + ArkUI 原生实现;
4. 复用行为规范、数据库 schema、Feed 语料和 API 契约,不强求 UI 源码复用。

### 5. 架构边界

```text
UI(features)
    ↓
Application(use cases)
    ↓
Domain(entities + policies)
    ↓
Repository interfaces
    ↓
Data(SQLite / HTTP / secure storage)
    ↓
Platform(Android / iOS adapters)
```

约束:

- Widget 不执行 SQL、HTTP 或 XML 解析;
- Domain 不依赖 Flutter UI、数据库实现或平台插件;
- Repository 返回领域模型,不泄漏数据库行;
- 网络抓取、解析和落库通过一个可取消的应用用例协调;
- 所有 schema 变更必须带迁移测试;
- 后台任务调用与前台刷新相同的用例,不复制业务逻辑。

## 不采用的方案

### 三端独立原生

Android/Kotlin、iOS/Swift、HarmonyOS/ArkTS 会导致业务逻辑、迁移和缺陷修复维护三份,不适合当前团队规模。

### Capacitor/WebView 作为核心运行时

旧实现已经归档。新版本需要更可控的长列表、后台任务、数据库和平台集成能力。

### 官方托管服务

暂不建设账户和官方云端,避免过早承担隐私、安全、计费和持续运维责任。

## 后果

正面:

- Android/iOS 共享主要业务和 UI;
- 离线和无服务器场景完整可用;
- 性能问题可通过 isolate、分页、索引和原生通道处理;
- 自托管与鸿蒙均有清晰扩展边界。

代价:

- 团队需要维护 Dart/Flutter 技能栈;
- iOS 构建仍要求完整 Xcode;
- Android 构建需要 Android SDK 和合适的 JDK;
- 鸿蒙后续可能需要独立 ArkTS UI 实现。
