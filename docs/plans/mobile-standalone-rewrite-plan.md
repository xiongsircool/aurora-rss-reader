# 移动端独立化重写计划(方案 D:端上轻后端)

> 状态:已归档/被替代 · 创建于 2026-05-31 · 归档实现见分支 `archive/mobile-plan-d-v1`
> 替代方案:Flutter 本地优先架构,见 `docs/adr/0001-mobile-local-first-flutter.md` 与 `docs/plans/mobile-flutter-m0-plan.md`
> 说明:本文只保留为历史决策和踩坑参考,不得作为新移动端实现依据。
> 原目标:把 `rss-mobile/` 从「依赖局域网内 Node 后端」重写为**完全独立、端上自洽**的移动 App。
> 手机端自己抓 RSS、自己归一化、自己存本地、直连 AI 接口,**不依赖任何后端进程**。

---

## 1. 为什么要重写

当前 `rss-mobile/` 通过 `src/api/mobile.ts` 调用桌面后端的 `/api/mobile` 接口(`getApiBaseUrl()` 默认 `http://<host>:15432/api`)。这意味着:

- 手机上必须有一台开着 Aurora 桌面后端的电脑,且与手机同网段;
- 一旦电脑关机/不同网络,App 完全不可用;
- 这不是一个独立的移动产品,只是桌面端的「远程遥控器」。

**方案 D 的定位**:移动端是一个**自包含**的 App。RSS 抓取、内容归一化、全文提取、AI 摘要/翻译、本地存储全部在端上完成,直连用户自己配置的 OpenAI 兼容 AI 接口。这与项目「本地优先、无官方服务器」的整体定位一致。

### 重写边界:重写什么、保留什么

| 层 | 处置 | 说明 |
|---|---|---|
| **数据来源层** `src/api/*` | 🔴 **删除重写** | 不再 HTTP 调后端,改为端上抓取 + 本地存储 + 直连 AI |
| **存储层**(新增) | 🟢 **新建** | 端上 SQLite / IndexedDB,替代 better-sqlite3 |
| **领域逻辑层**(新增) | 🟢 **移植** | 从 `backend-node/src/services` 移植抓取/归一化/presentation,DOM 实现换成浏览器原生 |
| **Store 层** `src/stores/*` | 🟡 **改造** | 接口签名基本不变,内部从「调 api」改为「调本地 repo/service」 |
| **UI 组件** `src/components/*`、`src/views/*` | 🟢 **保留** | inbox/reader/各模板设计良好,基本复用,按新设计稿微调 |
| **类型** `src/types.ts` | 🟢 **保留** | `InboxEntry`/`ReaderEntry`/`EntryPresentation` 模型沿用 |
| **UI 设计稿** `rss-mobile/design/ui/` | 🟢 **遵循** | 「一个混合收件箱 + 内容感知阅读模板」方向不变 |

---

## 2. 端上架构

```
┌─────────────────────────────────────────────────────┐
│                  Vue 3 UI (保留/微调)                  │
│   views/  components/  (inbox, reader 模板…)          │
├─────────────────────────────────────────────────────┤
│              Pinia Stores (改造内部实现)               │
│   inboxStore · readerStore · sourceStore · settings   │
├─────────────────────────────────────────────────────┤
│            领域服务层 (新建/移植 from backend)          │
│  feedFetcher · feedNormalizer · entryPresentation    │
│  articleExtractor · aiClient (summary/translate)     │
├─────────────────────────────────────────────────────┤
│                  存储层 (新建)                         │
│   repositories (feeds/entries/summaries/settings)    │
│        ↓ better SQLite (native) / sql.js (web)       │
├─────────────────────────────────────────────────────┤
│            平台能力 (Capacitor 插件)                   │
│  CapacitorHttp(绕 CORS) · SQLite · Browser · …        │
└─────────────────────────────────────────────────────┘
```

### 2.1 关键技术决策

**A. RSS 抓取与 CORS — 用 `CapacitorHttp`(本计划成立的前提)**
浏览器 `fetch` 抓第三方 RSS 会被 CORS 拦截。Capacitor 提供原生 HTTP(`CapacitorHttp` / `@capacitor/core`,或社区 `@capacitor-community/http`),走原生网络栈,**不受 CORS 限制**,且能拿到原始字节(处理非 UTF-8 编码的 RSS)。
- Web/PWA 调试模式下没有原生层 → 需要一个开发用 CORS 代理 fallback(仅 dev,不进生产)。

**B. RSS/XML 解析 — 端上换库**
后端 `fetcher.ts` 用 `rss-parser`(依赖 Node)。端上方案:
- 优先 `fast-xml-parser`(纯 JS、已在后端用,可跨端),自己适配 RSS/Atom 字段;或
- 评估 `rss-parser` 在 WebView 中能否直接跑(它依赖 `http`/`xml2js`,可能需要 polyfill)。
- 归一化逻辑(`normalizeFeedItem` 等)从 `feedNormalizer.ts` 移植。

**C. DOM 操作 — `jsdom` → 浏览器原生 `DOMParser`**
`feedNormalizer.ts` 和 `entryPresentation.ts` 都 `import { JSDOM } from 'jsdom'`(Node-only)。端上 WebView 自带 `DOMParser`/`document`,把 `new JSDOM(html).window.document` 替换成 `new DOMParser().parseFromString(html, 'text/html')`,其余 DOM 查询逻辑几乎不变。

**D. 全文提取(Readability)— `@mozilla/readability` 可跨端**
后端 `articleExtractionService` 用 `@mozilla/readability` + `jsdom`。`@mozilla/readability` 本身只需要一个 DOM 文档,端上用 `DOMParser` 喂给它即可,无需 jsdom。抓正文同样走 `CapacitorHttp`。

**E. AI(摘要/翻译)— 直接 fetch,不移植 OpenAI SDK**
后端 `ai.ts` 用 `openai` SDK,但本质是 POST `/chat/completions`。端上直接用 `CapacitorHttp` POST 到用户配置的 OpenAI 兼容端点即可,体积更小、无 Node 依赖。沿用现有逻辑:`<think>` 标签剥离、`userPreference` 提示词注入、Markdown 输出。
- 嵌入/语义搜索(`sqlite-vss`)**首期不做**(端上 vss 不可用),只做关键字搜索。

**F. 本地存储 — SQLite 优先**
- 原生(iOS/Android):`@capacitor-community/sqlite`,schema 可从 `backend-node/src/db/init.ts` 裁剪移植(去掉 FTS5-vss、jobs 等服务端概念,保留 feeds/entries/summaries/translations/settings/tags)。
- Web/PWA:`@capacitor-community/sqlite` 的 jeep-sqlite (wasm) 或退化到 IndexedDB。
- 用 Repository 模式封装,store 只依赖 repo 接口,不感知底层是 SQLite 还是 IndexedDB。

**G. 后台刷新**
- 前台:打开 App / 下拉刷新触发抓取(已有 `refreshFeeds()` 入口)。
- 后台定时:`@capacitor/background-runner` 或平台后台任务(iOS BGTaskScheduler / Android WorkManager)。**首期可只做前台刷新**,后台刷新列为二期。

---

## 3. 目标目录结构(`rss-mobile/src/`)

```
src/
├── platform/              # 新建:平台能力封装(便于 web/native 切换)
│   ├── http.ts            #   CapacitorHttp 封装(抓 RSS / 调 AI / 抓正文)
│   └── db.ts              #   SQLite 连接(native) / sql.js (web)
├── data/                  # 新建:端上数据层(替代旧 api/)
│   ├── repositories/      #   feedRepo, entryRepo, summaryRepo, settingsRepo, tagRepo
│   ├── schema.ts          #   建表 SQL(裁剪自 backend init.ts)
│   └── migrations.ts
├── domain/                # 新建:领域服务(移植自 backend services)
│   ├── feedFetcher.ts     #   抓取 + 解析(移植 fetcher + rss 解析)
│   ├── feedNormalizer.ts  #   移植自 backend,jsdom → DOMParser
│   ├── entryPresentation.ts  # 移植自 backend,jsdom → DOMParser
│   ├── articleExtractor.ts   # Readability + DOMParser
│   └── aiClient.ts        #   摘要/翻译,直接 fetch OpenAI 兼容接口
├── stores/                # 改造:inboxStore/readerStore/sourceStore/settingsStore
├── views/  components/     # 保留 + 按设计稿微调
├── composables/  utils/  types.ts   # 大部分保留
└── (删除) api/
```

---

## 4. 实施阶段(建议按里程碑推进,每个里程碑可独立验证)

### M0 — 脚手架与平台层(地基)
- [ ] 引入依赖:`@capacitor-community/sqlite`、确认 `CapacitorHttp` 可用;web fallback(sql.js / jeep-sqlite)
- [ ] `platform/http.ts`:统一抓取封装(native 走 CapacitorHttp,dev-web 走代理),处理超时/编码/错误
- [ ] `platform/db.ts`:打开/初始化数据库连接
- [ ] `data/schema.ts` + `migrations.ts`:从 backend `init.ts` 裁剪出端上表结构
- ✅ 验证:App 能启动、建库成功、能用 CapacitorHttp 抓到一个公开 RSS 的原始 XML

### M1 — 数据层与抓取闭环(核心)
- [ ] `data/repositories/*`:feeds / entries / summaries / settings 的 CRUD
- [ ] `domain/feedNormalizer.ts`:移植后端逻辑,jsdom → DOMParser,补端上单测
- [ ] `domain/feedFetcher.ts`:抓取 → 解析 XML → normalize → 落库(去重、etag/last-modified)
- [ ] `domain/entryPresentation.ts`:移植,产出 `EntryPresentation`(content_type 判定、图片/视频提取)
- [ ] 改造 `sourceStore`(增删订阅、分组)与 `inboxStore`(从 repo 取数、分页、已读/收藏)
- ✅ 验证:添加订阅源 → 刷新 → 收件箱出现文章 → 标记已读/收藏持久化(重启仍在)

### M2 — 阅读与内容模板
- [ ] `domain/articleExtractor.ts`:Readability 抓全文,`readerStore` 改造
- [ ] 打通 reader 各模板(article/image/gallery/video)与 `EntryPresentation`
- [ ] 视频处理:复用桌面 `useVideoExtractor` 思路(youtube/bilibili/vimeo embed)
- ✅ 验证:不同类型文章用对应模板正确渲染;长文能抓到正文

### M3 — AI(摘要/翻译)
- [ ] `domain/aiClient.ts`:直连 OpenAI 兼容接口,摘要/翻译,`<think>` 剥离、提示词注入
- [ ] 摘要/翻译结果落 `summaries`/`translations` 表缓存(对齐桌面行为)
- [ ] 设置页:AI 端点 / key / 模型 / 个性化提示词配置(`settingsStore` + settings 表)
- ✅ 验证:配置 key 后能生成摘要并缓存;翻译可用;无 key 时优雅降级

### M4 — 搜索、标签、收藏、设置完善
- [ ] 关键字搜索(端上,首期不做语义搜索)
- [ ] 标签(沿用 user_tags/entry_tags 表)、SavedView 收藏列表
- [ ] OPML 导入/导出(纯端上解析,方便从桌面/其他阅读器迁移)
- ✅ 验证:搜索/标签/收藏/OPML 导入均可用

### M5 — 打磨与原生集成
- [ ] 后台定时刷新(background-runner / 平台任务)
- [ ] iOS/Android 真机构建(`cap:sync` → Xcode / Android Studio),图标/启动屏/权限
- [ ] 性能:虚拟滚动、抓取并发控制(移植 `runWithConcurrency`)、图片懒加载
- ✅ 验证:真机端到端跑通,冷启动/刷新性能可接受

---

## 5. 与桌面端的关系

- **代码复用**:领域逻辑(normalizer/presentation/ai 提示词)是从桌面后端**移植并适配**,不是共享运行时。可考虑后续抽一个纯逻辑包,但首期以「复制 + 改 DOM 实现」为主,避免过早抽象。
- **数据同步**:本计划**不含**跨设备同步(那是 README 路线图 v0.3「数据同步」)。移动端独立后,未来若做同步,可作为可选连接自托管后端(项目已有 Dockerfile)。
- **桌面端不受影响**:本次只改 `rss-mobile/`;`backend-node/` 与 `rss-desktop/` 保持现状。当前分支里 `routes/mobile.ts`、`entryPresentation.ts`(后端版)可保留(桌面/局域网场景仍可用),与端上版本并存。

---

## 6. 主要风险与待确认

| 风险 | 影响 | 缓解 |
|---|---|---|
| `CapacitorHttp` 抓 RSS 的编码/重定向/异常源兼容性 | 高(地基) | M0 先用一批真实源压测;保留代理 fallback |
| `rss-parser` 能否在 WebView 跑,或改用 `fast-xml-parser` 自适配 | 中 | M1 评估,倾向 fast-xml-parser |
| jsdom → DOMParser 行为差异(部分 API 不同) | 中 | 移植时补单测对照桌面输出 |
| 端上 SQLite 在 web/PWA 的体验 | 中 | 原生优先,web 作为降级 |
| 后台刷新受 iOS/Android 后台策略限制 | 低(可延后) | 首期前台刷新,后台列二期 |
| 大量历史文章端上抓取/存储的性能 | 中 | 并发控制 + 分页 + 限制单次抓取量 |

## 7. 待你拍板的决策点

1. **存储**:原生 SQLite + web sql.js 降级 ✅(默认推荐),还是直接 IndexedDB 统一?
2. **XML 解析**:`fast-xml-parser` 自适配 ✅(推荐,无 Node 依赖),还是先试 `rss-parser`?
3. **首期范围**:是否同意「语义搜索 / 后台刷新 / 跨设备同步」全部列入二期,首期只做前台抓取闭环 + AI 摘要翻译?
4. **现有移动端 UI**:是「保留并适配」✅,还是连 UI 也按新设计稿从零重做?
