# rss-mobile 重写开发计划(方案 D · 端上自洽 + 移动端原生 UI)

> 开发执行用清单。架构背景见 [`../docs/plans/mobile-standalone-rewrite-plan.md`](../docs/plans/mobile-standalone-rewrite-plan.md)。
> UI 方向见 [`design/ui/README.md`](design/ui/README.md)(已批准,本计划遵循)。
> 状态:草案 · 2026-05-31 · 关联 issue #16 #13

## 0. 总原则(每个 PR 都要满足)

- **端上自洽**:不依赖任何外部后端进程。RSS 抓取 / 归一化 / 全文提取 / AI / 存储全部在端上。
- **移动端原生 UI**:不复制桌面布局。遵循 `design/ui/README.md` —— 底部 4 tab、单一混合收件箱、内容感知阅读模板。旧的从桌面移植来的组件**重新设计**,只保留 `types.ts` 数据模型。
- **每个里程碑可独立运行验证**,不留半截 App。
- **质量门禁**:`pnpm typecheck` 通过 + 该里程碑的测试点全绿 + 真机/模拟器冒烟通过,才算完成。
- ⚠️ **与旧 v2 计划的关键差异**:`design/ui/mobile-implementation-plan-v2.md` 假设 presentation 逻辑放在后端;方案 D 下这些逻辑全部放到端上 `src/domain/`,该文档仅作 UI/字段参考。

---

## 1. 全局质量门禁(每个里程碑结束都跑)

| 检查 | 命令 / 方式 | 通过标准 |
|---|---|---|
| 类型 | `pnpm typecheck` | 0 error |
| 构建 | `pnpm build` | 成功产出 dist/ |
| 单测 | `pnpm test`(M0 引入 vitest) | 全绿 |
| Web 冒烟 | `pnpm dev` 浏览器 | 该里程碑功能可操作 |
| 原生冒烟 | `pnpm cap:sync` → 模拟器 | 抓取/AI 等需原生能力的功能真机可用 |
| 回归 | 手动跑「核心动线」(见 §8) | 无崩溃、无数据丢失 |

---

## M0 — 脚手架与平台层(地基)

**目标**:App 能启动、建库成功、能用原生 HTTP 抓到真实 RSS 的原始 XML。

任务:
- [ ] 引入测试框架(`vitest`)、`@capacitor-community/sqlite`,确认 `CapacitorHttp` 可用
- [ ] `src/platform/http.ts`:统一抓取封装。native → `CapacitorHttp`;dev-web → 代理 fallback。处理超时、重定向、字符编码(非 UTF-8 RSS)、二进制/文本
- [ ] `src/platform/db.ts`:打开数据库;native 用 SQLite,web 用 jeep-sqlite(wasm)降级
- [ ] `src/data/schema.ts`:裁剪自 `backend-node/src/db/init.ts`,保留 `feeds / entries / summaries / translations / user_settings / user_tags / entry_tags`;**去掉** FTS5-vss、jobs、scope/digest、ai_automation 等服务端概念
- [ ] `src/data/migrations.ts`:版本化建表

**关键检查点**:
- [ ] CapacitorHttp 在 **iOS + Android 模拟器**都能抓到第三方 RSS(CORS 不拦截)
- [ ] DB 在 native 与 web 两路都能建表成功
- [ ] http 封装对超时/404/非 XML 响应有明确错误返回,不抛裸异常

**测试点**:
- 单测:`http.ts` 编码探测(UTF-8 / GBK 样例)、错误归类
- 单测:`schema` 建表幂等(重复 init 不报错)
- 冒烟:启动 App → 控制台打印成功抓到的某公开源字节数

**验收**:✅ 一个临时按钮点一下,能抓到并打印某真实 RSS 的原始内容,DB 文件已创建。

---

## M1 — 数据层与抓取闭环(核心)

**目标**:添加订阅 → 刷新 → 收件箱出现文章 → 已读/收藏持久化(重启仍在)。

任务:
- [ ] `src/data/repositories/`:`feedRepo` `entryRepo` `settingsRepo` 的 CRUD(去重键、分页游标)
- [ ] `src/domain/feedNormalizer.ts`:移植自 backend,**`jsdom` → `DOMParser`**;补端上单测对照桌面输出
- [ ] XML 解析:用 `fast-xml-parser` 自适配 RSS/Atom/JSON Feed(决策见架构文档 §7.2)
- [ ] `src/domain/feedFetcher.ts`:抓取 → 解析 → normalize → 落库;支持 etag / last-modified 条件请求、去重、`runWithConcurrency` 并发控制
- [ ] `src/domain/entryPresentation.ts`:移植,产出 `EntryPresentation`(content_type 判定 + 图片/视频提取),DOM 换原生
- [ ] 改造 `sourceStore`(订阅增删、分组、自动探测源类型)与 `inboxStore`(从 repo 取数,接口签名尽量不变)

**关键检查点**:
- [ ] 抓取并发受控,不会一次性打爆几十个源
- [ ] 去重正确:同源刷新两次不产生重复 entry
- [ ] content_type 分类正确:video/gallery/image/article 各有真实样例命中
- [ ] 相对 URL(图片/链接)正确解析为绝对地址;过滤掉 tracking pixel / logo / avatar / data URI
- [ ] 已读/收藏写库后,杀进程重启数据仍在

**测试点**:
- 单测:`feedNormalizer` —— 日期解析、enclosure、图片提取、icon 选择(移植后端 `test/feedNormalizer.test.ts` 的用例)
- 单测:`entryPresentation` —— 四种 content_type 分类、lead image 选择、相对路径解析
- 单测:`feedFetcher` —— 去重、etag 命中跳过
- 冒烟:加 3 个不同类型源(博客 / 图站 / B站或YouTube)→ 收件箱混排正确

**验收**:✅ 设计稿 `01-inbox-mixed-feed` 的收件箱真实跑起来,数据来自端上抓取与存储。

---

## M2 — 移动端 UI 重构:收件箱 + 内容感知阅读模板

**目标**:按 `design/ui/README.md` 重构 UI(不是移植桌面),四种阅读模板按内容类型渲染。

任务:
- [ ] 视觉基线:落地设计稿的配色(暖白底 / 炭黑字 / 静teal主色 / 克制amber状态色)、≤8px圆角、reader-first 字号、薄分隔线;**禁止**渐变blob/营销hero/嵌套卡片/紫色系/桌面仪表盘布局
- [ ] 底部 tab:Inbox / Sources / Saved / Settings,默认 Inbox
- [ ] **Inbox**:顶部 search+sync;分段筛选 All/Unread/Saved;来源/分组 chips;混排列表;行内根据 content_type 出小视觉提示(缩略图/类型标签)
- [ ] **Blog Reader**:返回、来源/时间/阅读时长、标题、可选紧凑 AI 摘要、干净正文(代码块/引用/标题/列表/图片样式)、底部 Summary/Save/Share/Original
- [ ] **Image / Gallery Reader**:大图、正文引子、图片网格/竖向流、caption、全屏看图入口
- [ ] **Video Reader**:大封面、播放/打开动作、时长徽标、描述、可选 AI 摘要;**不自动播放**,内嵌不稳时优先打开原视频
- [ ] `articleExtractor.ts`(Readability + DOMParser)+ `readerStore` 改造,供 Blog Reader 抓全文
- [ ] 视频处理移植桌面 `useVideoExtractor` 思路(youtube/bilibili/vimeo embed)到 `domain/`

**关键检查点**:
- [ ] UI 在小屏(iPhone SE 宽度)与大屏(平板)都不溢出、可单手扫读
- [ ] content_type 路由到正确模板;同一条 entry 类型判定稳定
- [ ] 长文 Readability 抓取成功率(抽样 10 篇)可接受;失败时降级到 summary/content 不白屏
- [ ] 看图全屏、视频打开外链都能工作;视频不自动播放
- [ ] 暗色/亮色与系统主题协调(若做暗色)

**测试点**:
- 单测:reader 模板选择函数(content_type → 组件)
- 单测:articleExtractor 对无正文/抓取失败的降级路径
- 冒烟:四类内容各开一篇,逐一核对设计稿 02/03/04 还原度
- 视觉走查:对照 `design/ui/concepts/*.png`

**验收**:✅ 四张设计稿对应的界面在真机还原;阅读动线顺滑。

---

## M3 — AI(摘要 / 翻译,端上直连)

**目标**:配置 AI key 后能在阅读页生成摘要、翻译,结果落库缓存。

任务:
- [ ] `src/domain/aiClient.ts`:`CapacitorHttp` 直连 OpenAI 兼容 `/chat/completions`;移植桌面 `ai.ts` 行为:`<think>` 标签剥离、`userPreference` 提示词注入、Markdown 输出、错误归类
- [ ] 摘要 → 落 `summaries` 表;翻译 → 落 `translations` 表(按 entry+language 缓存,命中不重复请求)
- [ ] Settings 页:AI 端点 / API key / 模型 / 个性化提示词;**不暴露** MCP、复杂 AI workflow(遵循设计稿"avoid")
- [ ] Reader 内"紧凑 AI 摘要"面板;重新生成动作真实生效(规避桌面 issue #14.8)

**关键检查点**:
- [ ] 摘要输出为 Markdown 并正确渲染(规避桌面 issue #14.4)
- [ ] 缓存命中:同一文章二次进入不再请求 AI
- [ ] 个性化提示词确实被带入请求(规避 #14.10)
- [ ] 无 key / 请求失败时优雅降级,有明确提示,不崩
- [ ] key 存储安全(优先安全存储,至少不明文打印日志)

**测试点**:
- 单测:`<think>` 剥离、提示词拼装、响应解析与错误归类
- 单测:缓存读写(命中/未命中)
- 冒烟:配置真实 key → 生成摘要(Markdown 正确)→ 翻译 → 重启后缓存仍在

**验收**:✅ Reader 页可生成并缓存摘要/翻译;无 key 时不影响阅读。

---

## M4 — 搜索 / 标签 / 收藏 / OPML

**目标**:端上关键字搜索、标签、收藏列表、OPML 导入导出可用。

任务:
- [ ] 关键字搜索(端上 SQL LIKE / FTS5;**语义搜索不做**,列二期)
- [ ] 标签:`user_tags` / `entry_tags`,Reader 内打标签;按标签筛选收件箱
- [ ] **Saved** tab:收藏列表
- [ ] OPML 导入/导出(纯端上解析,方便从桌面 / 其他阅读器迁移)

**关键检查点**:
- [ ] 搜索覆盖 title/summary/content,结果分页正确
- [ ] OPML 导入大文件(>100 源)不卡死;格式兼容主流阅读器导出
- [ ] 已读状态在标签/搜索结果里一致(规避桌面 issue #14.14)

**测试点**:
- 单测:OPML parse/serialize round-trip
- 单测:搜索查询构造与转义(防注入/特殊字符)
- 冒烟:导入一份真实 OPML → 源全部出现 → 搜索/标签/收藏走一遍

**验收**:✅ 可从其他阅读器迁移进来并完整使用。

---

## M5 — 原生集成与打磨

**目标**:真机端到端跑通,性能与原生体验达标。

任务:
- [ ] 后台定时刷新(`@capacitor/background-runner` 或平台后台任务;前台刷新已在 M1)
- [ ] 真机构建:`cap:sync` → Xcode / Android Studio;图标、启动屏、权限文案、网络权限
- [ ] 性能:长列表虚拟滚动、图片懒加载、抓取并发与超时调优
- [ ] 下拉刷新、骨架屏 / 空态 / 错误态、触觉反馈(`@capacitor/haptics`)

**关键检查点**:
- [ ] iOS 与 Android 真机均能冷启动、抓取、阅读、AI、退出后台再回来数据不丢
- [ ] 千条 entry 列表滚动不卡(虚拟滚动)
- [ ] 弱网/断网下有明确提示与重试,不白屏
- [ ] 后台刷新受系统策略限制时有合理降级(不保证但不报错)

**测试点**:
- 冒烟:iOS 真机 + Android 真机各跑一遍完整核心动线(§8)
- 性能:1000 条 entry 列表帧率目测无明显掉帧
- 网络:飞行模式下打开 App 行为正确

**验收**:✅ 可提交到内测分发,核心动线在两端真机稳定。

---

## 8. 核心动线(每个里程碑回归必跑)

1. 启动 App → 进入 Inbox
2. Sources 添加一个真实订阅(粘贴 URL,自动探测类型)
3. 下拉 / sync → Inbox 出现混排文章
4. 打开一篇文章 → 命中正确阅读模板
5. (M3+)生成 AI 摘要 → Markdown 正确渲染并缓存
6. 标记已读 / 收藏 → Saved tab 可见
7. 杀进程重启 → 上述状态与数据全部还在

## 9. 不在本次范围(列二期)

- 语义 / 向量搜索(端上 sqlite-vss 不可用)
- 跨设备数据同步 / 云备份(README 路线图 v0.3)
- 自动化规则 / 范围摘要 / 日报 / MCP(桌面端能力,移动端刻意不做)

## 10. 开发前待拍板(同架构文档 §7)

1. 存储:原生 SQLite + web jeep-sqlite 降级(推荐)?
2. XML 解析:`fast-xml-parser` 自适配(推荐)?
3. 首期范围:语义搜索 / 后台刷新 / 同步全列二期,首期=抓取闭环 + 阅读模板 + AI 摘要翻译?
4. UI:按 `design/ui/README.md` **重构**(本计划默认),已确认 ✅
