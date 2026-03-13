# AI 自动化与聚合 Digest 架构设计

> 创建时间: 2026-03-13
> 状态: 设计中
> 目标: 在兼容现有摘要/翻译/标签系统的前提下，重构 AI 自动化与聚合摘要架构，为后续按订阅源、分组、标签的精细化控制提供统一底层。

## 一、背景与问题

当前仓库中的 AI 相关能力已经分化为三条链路：

- 单篇文章摘要
  - 前端入口: [AppHome.vue](/Users/Apple/Documents/githubs/aurora-rss-reader/rss-desktop/src/views/AppHome.vue)
  - 页面状态: [useEntryAI.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/rss-desktop/src/composables/useEntryAI.ts)
  - 后端入口: [ai.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/backend-node/src/routes/ai.ts)
- 标题翻译 / 全文翻译
  - 前端状态: [useEntryAI.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/rss-desktop/src/composables/useEntryAI.ts)、[useTitleTranslation.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/rss-desktop/src/composables/useTitleTranslation.ts)、[useArticleTranslation.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/rss-desktop/src/composables/useArticleTranslation.ts)
  - 后端入口: [ai.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/backend-node/src/routes/ai.ts)
- 标签聚合简报 digest
  - 前端入口: [DigestView.vue](/Users/Apple/Documents/githubs/aurora-rss-reader/rss-desktop/src/components/tags/DigestView.vue)
  - 状态管理: [tagsStore.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/rss-desktop/src/stores/tagsStore.ts)
  - 后端入口: [tags.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/backend-node/src/routes/tags.ts)

当前存在的核心问题：

- AI 自动开关集中在 `user_settings` 单例中，只有全局布尔值，无法按订阅源/分组/标签覆盖。
- 单篇文章摘要与标签 digest 都依赖摘要模型配置，但提示词和任务语义完全不同，当前没有“任务层”的抽象。
- 标签 digest 仅支持 `tag_digest`，若后续增加 `feed_digest` 和 `group_digest`，大概率会复制一套相近逻辑并继续膨胀 [tags.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/backend-node/src/routes/tags.ts)。
- 前端设置页 [SettingsAIFeatures.vue](/Users/Apple/Documents/githubs/aurora-rss-reader/rss-desktop/src/components/settings/SettingsAIFeatures.vue) 仍围绕全局布尔开关建模，不适合扩展。

## 二、设计目标

### 2.1 业务目标

- 支持按 `global / group / feed / tag` 四类范围控制 AI 自动行为。
- 将 `feed_digest / group_digest / tag_digest` 合并为统一的聚合摘要任务。
- 保留现有单篇文章摘要、标题翻译、全文翻译与标签 digest 的行为兼容。
- 为后续“带引用的 markdown 摘要展示”预留数据结构，但第一阶段不强制前端升级交互。

### 2.2 技术目标

- 引入统一的 `task + prompt profile + automation rule` 三层模型。
- 后端将摘要和聚合 digest 的执行逻辑沉入 service 层，不再堆叠在路由文件。
- 允许渐进迁移，优先兼容现有 `summaries`、`translations`、`digest_tag_summaries` 表。

## 三、核心设计

### 3.1 统一任务模型

建议将 AI 能力统一定义为任务，而不是继续围绕“摘要”“翻译”两个服务名扩字段。

```ts
type AITaskKey =
  | 'entry_summary'
  | 'title_translation'
  | 'fulltext_translation'
  | 'aggregate_digest'
  | 'smart_tagging'
```

其中：

- `entry_summary`
  - 单篇文章摘要
- `title_translation`
  - 标题翻译
- `fulltext_translation`
  - 正文分块翻译
- `aggregate_digest`
  - 聚合摘要，统一覆盖 `feed / group / tag`
- `smart_tagging`
  - 智能打标签

### 3.2 统一范围模型

```ts
type AIScopeType = 'global' | 'feed' | 'group' | 'tag'
```

其中：

- `global`
  - 全局默认行为
- `feed`
  - 单个订阅源
- `group`
  - 订阅分组
- `tag`
  - 标签范围

### 3.3 任务与范围的关系

并不是所有任务都支持所有范围：

- `entry_summary`
  - 支持 `global / group / feed`
- `title_translation`
  - 支持 `global / group / feed`
- `fulltext_translation`
  - 仅建议保留 `global`
- `aggregate_digest`
  - 支持 `global / group / feed / tag`
  - 但运行时必须显式带 `scope_type`
- `smart_tagging`
  - 支持 `global / group / feed / tag`

### 3.4 提示词层

提示词不直接绑在服务配置上，而是绑在任务上。

```ts
type PromptProfileKey =
  | 'entry_summary_v1'
  | 'title_translation_v1'
  | 'fulltext_translation_v1'
  | 'aggregate_digest_v1'
  | 'smart_tagging_v1'
```

重点：

- `entry_summary` 与 `aggregate_digest` 不共享提示词。
- `aggregate_digest` 内部统一一套模板，通过 `scope_type` 注入上下文。
- `feed_digest / group_digest / tag_digest` 不拆成三套任务，只是 `aggregate_digest` 的三个 scope。

## 四、聚合 Digest 设计

### 4.1 为什么统一为 `aggregate_digest`

用户对 `feed_digest / group_digest / tag_digest` 的核心预期相同：

- 输入是一批文章
- 输出是阶段性总结
- 摘要风格接近
- 后续都可能要插入引用、悬浮卡片、跳转原文

因此不建议为三者分别维护三套路由、三套表、三套 prompt。

### 4.2 输入模型

后端在调用模型前统一构造输入项：

```ts
type DigestSourceItem = {
  ref: number
  entry_id: string
  title: string
  summary?: string | null
  content_snippet?: string | null
  feed_title?: string | null
  group_name?: string | null
  published_at?: string | null
}
```

规则：

- 服务端预先生成 `ref -> entry_id` 的稳定映射。
- 优先使用 `entry.summary`；无摘要时使用 `readability_content/content` 的受限片段。
- 每条输入长度严格裁剪，避免 token 成本失控。
- 聚合任务不直接喂全文。

### 4.3 输出模型

为节省 token，不让模型回传标题、时间、来源等可由数据库回查的信息。

推荐第一版输出：

```ts
type AggregateDigestOutput = {
  summary_md: string
  citations: Array<{
    ref: number
    entry_id: string
  }>
  keywords?: string[]
}
```

说明：

- `summary_md`
  - 主展示内容，允许 `Markdown`
  - 引用采用 `[1] [2]` 风格
- `citations`
  - 仅保存 `ref -> entry_id`
  - 标题、来源、时间由后端或前端运行时查询
- `keywords`
  - 可选字段，首版不是硬要求

第一版不建议让模型输出 HTML，也不建议直接输出 `<span data-id>`。
后续若要支持富引用，可基于 `summary_md + citations` 做渲染增强。

### 4.4 提示词原则

`aggregate_digest` 提示词应满足：

- 明确告知每条输入都带有编号 `ref`
- 所有结论只能基于输入
- 引用信息只使用 `[n]`
- 不输出标题列表式流水账
- 不要求模型回填 `entry_id`
- 按范围注入上下文

示例上下文变量：

```ts
type AggregateDigestPromptContext = {
  scope_type: 'feed' | 'group' | 'tag'
  scope_label: string
  time_range_label: string
  ui_language: string
}
```

不同 scope 的差异只体现在：

- “这是某订阅近期文章”
- “这是某分组近期文章”
- “这是某标签近期文章”

而不体现在任务结构上。

## 五、自动化规则设计

### 5.1 新表

建议新增 `ai_automation_rules` 表：

```sql
CREATE TABLE IF NOT EXISTS ai_automation_rules (
  id TEXT PRIMARY KEY,
  task_key TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT,
  mode TEXT NOT NULL DEFAULT 'inherit',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_automation_rules_task_scope
  ON ai_automation_rules(task_key, scope_type, scope_id);
```

字段说明：

- `task_key`
  - 例如 `entry_summary`、`aggregate_digest`
- `scope_type`
  - `global / group / feed / tag`
- `scope_id`
  - `global` 时允许为空
  - `feed/tag` 用主键 id
  - `group` 使用 `group_name`
- `mode`
  - `inherit`
  - `enabled`
  - `disabled`

### 5.2 优先级规则

#### 文章级任务

- `feed > group > global`

适用于：

- `entry_summary`
- `title_translation`

#### 聚合摘要任务

- `feed_digest`
  - `feed > group > global`
- `group_digest`
  - `group > global`
- `tag_digest`
  - `tag > global`

但系统内部仍统一通过 `aggregate_digest` 解析，只是执行上下文不同。

### 5.3 为什么 `tag_digest` 不受 `feed/group` 规则影响

原因是当前标签 digest 已经是独立业务链路：

- 数据来源是标签命中文章集合
- 执行入口在 [tags.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/backend-node/src/routes/tags.ts)
- 结果展示在 [DigestView.vue](/Users/Apple/Documents/githubs/aurora-rss-reader/rss-desktop/src/components/tags/DigestView.vue)

如果 `tag_digest` 被 `feed/group` 自动摘要规则连带影响，用户会遇到“文章自动摘要关闭后，标签 digest 也不更新”的行为混乱。

因此建议：

- `entry_summary` 是文章级任务
- `aggregate_digest(tag)` 是标签级任务
- 两者只共享摘要模型配置，不共享自动化判定

## 六、存储设计

### 6.1 现状

目前已有三类存储：

- 单篇文章摘要: `summaries`
- 翻译: `translations`
- 标签 digest 历史: `digest_tag_summaries`

### 6.2 推荐演进方向

第一阶段不强推统一 artifact 表，优先兼容现有数据结构。

建议新增一张聚合摘要表，用于承接 `feed/group/tag` 三类 digest：

```sql
CREATE TABLE IF NOT EXISTS aggregate_digests (
  id TEXT PRIMARY KEY,
  task_key TEXT NOT NULL DEFAULT 'aggregate_digest',
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  period TEXT NOT NULL,
  time_range_key TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'zh',
  source_count INTEGER NOT NULL DEFAULT 0,
  source_hash TEXT NOT NULL,
  summary_md TEXT NOT NULL,
  citations_json TEXT NOT NULL,
  keywords_json TEXT,
  model_name TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'auto',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aggregate_digests_scope_period
  ON aggregate_digests(scope_type, scope_id, period, time_range_key, language);
```

### 6.3 与现有 `digest_tag_summaries` 的关系

有两种路线：

#### 路线 A：先兼容保留

- `tag_digest` 继续写 `digest_tag_summaries`
- `feed/group_digest` 写新表 `aggregate_digests`
- 后续再迁移

优点：

- 上线风险最低
- 不影响当前标签页显示

缺点：

- 一段时间内有双轨存储

#### 路线 B：直接统一迁移

- 新建 `aggregate_digests`
- 迁移历史 `digest_tag_summaries` 数据到新表
- 标签页改从新表读取

优点：

- 架构最干净

缺点：

- 改动面大
- 需要同步改 [tags.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/backend-node/src/routes/tags.ts) 与前端 digest 查询接口

本项目更建议先走路线 A，等 `feed/group_digest` 站稳后再统一。

## 七、后端改造计划

### 7.1 新服务层

建议新增以下服务文件：

- `backend-node/src/services/aiConfigResolver.ts`
  - 统一解析某 task 使用哪个 service config
- `backend-node/src/services/aiPromptResolver.ts`
  - 统一解析 prompt profile 与变量注入
- `backend-node/src/services/aiAutomationResolver.ts`
  - 根据 `task + scope` 判断是否自动触发
- `backend-node/src/services/aggregateDigest.ts`
  - 统一的聚合摘要执行服务
- `backend-node/src/services/entrySummary.ts`
  - 单篇文章摘要执行服务

### 7.2 路由拆分建议

当前 [ai.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/backend-node/src/routes/ai.ts) 与 [tags.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/backend-node/src/routes/tags.ts) 已经偏大。

建议拆分为：

- `routes/aiConfig.ts`
  - 获取与保存 AI 配置
- `routes/aiEntry.ts`
  - 单篇文章摘要、标题翻译、全文翻译
- `routes/aiDigest.ts`
  - `feed/group/tag` 聚合摘要统一入口
- `routes/tags.ts`
  - 保留标签 CRUD、条目打标签、规则匹配

### 7.3 新接口建议

#### 自动化规则

- `GET /api/ai/automation-rules`
- `PATCH /api/ai/automation-rules`

#### 聚合摘要

- `GET /api/ai/digests`
  - 参数：
    - `scope_type=feed|group|tag`
    - `scope_id`
    - `period=latest|week|custom`
    - `ui_language`
- `POST /api/ai/digests/regenerate`
  - 参数：
    - `scope_type`
    - `scope_id`
    - `period`
    - `ui_language`

返回：

```json
{
  "item": {
    "summary_md": "...",
    "citations": [
      { "ref": 1, "entry_id": "..." }
    ],
    "keywords": ["..."],
    "created_at": "...",
    "time_range_key": "..."
  }
}
```

## 八、前端改造计划

### 8.1 设置页

当前 [SettingsAIFeatures.vue](/Users/Apple/Documents/githubs/aurora-rss-reader/rss-desktop/src/components/settings/SettingsAIFeatures.vue) 仍以全局布尔开关为中心。

建议升级为两层：

- 全局 AI 开关与默认行为
- 各任务默认策略

新增模型：

```ts
type AutomationMode = 'inherit' | 'enabled' | 'disabled'

type AutomationRule = {
  task_key: 'entry_summary' | 'title_translation' | 'aggregate_digest' | 'smart_tagging'
  scope_type: 'global' | 'feed' | 'group' | 'tag'
  scope_id?: string | null
  mode: AutomationMode
}
```

### 8.2 订阅源与分组右键菜单

为了避免再次出现“功能入口散乱”的问题，建议：

- 订阅源右键支持：
  - 补打标签
  - 生成订阅聚合摘要
  - 设置该订阅 AI 自动规则
- 分组右键支持：
  - 生成分组聚合摘要
  - 设置该分组 AI 自动规则
- 标签右键支持：
  - 重新生成标签 digest
  - 设置该标签自动 digest 规则

### 8.3 前端渲染方式

首版前端只渲染：

- `summary_md`

如果需要引用列表，可通过：

- `citations[].entry_id` 回查文章
- 点击 `[1]` 后展示标题、来源、发布时间

这意味着第一阶段不需要复杂富文本解析器，只需在 `MarkdownContent` 基础上做轻量增强。

## 九、迁移方案

### 9.1 数据迁移阶段

#### Phase 1：引入新表，不改旧功能

- 新增 `ai_automation_rules`
- 新增 `aggregate_digests`
- 保留 `user_settings` 中原字段
- 保留 `digest_tag_summaries`

#### Phase 2：接管文章级自动化判定

- `ai_auto_summary`
  - 迁移为 `entry_summary + global`
- `ai_auto_title_translation`
  - 迁移为 `title_translation + global`
- `ai_auto_tagging`
  - 迁移为 `smart_tagging + global`

迁移后：

- 旧字段继续保留一段时间
- 新系统读取优先级更高
- 若无新规则，则回落到旧字段

#### Phase 3：接入聚合 digest

- `tag_digest` 先从旧 digest 路由平滑接入 resolver
- 再新增 `feed_digest`
- 再新增 `group_digest`

#### Phase 4：统一清理

- 移除对旧全局布尔字段的直接依赖
- 决定是否淘汰 `digest_tag_summaries`

### 9.2 为什么不建议一步到位删旧字段

原因：

- [useEntryAI.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/rss-desktop/src/composables/useEntryAI.ts) 仍基于 `aiStore.config.features.auto_summary`、`auto_title_translation`
- [SettingsAIFeatures.vue](/Users/Apple/Documents/githubs/aurora-rss-reader/rss-desktop/src/components/settings/SettingsAIFeatures.vue) 仍直接编辑这些字段
- [tags.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/backend-node/src/routes/tags.ts) 的 digest 自动再生已在线工作

一步删掉会造成前后端同时大面积返工，风险不必要。

## 十、与当前代码的对应关系

### 10.1 会直接受影响的前端文件

- [useEntryAI.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/rss-desktop/src/composables/useEntryAI.ts)
  - 当前直接依赖全局开关
  - 后续应改为依赖 `resolveAutomationPolicy`
- [useTitleTranslation.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/rss-desktop/src/composables/useTitleTranslation.ts)
  - 当前只关心是否启用自动标题翻译
  - 后续应按 feed/group 规则判定
- [SettingsAIFeatures.vue](/Users/Apple/Documents/githubs/aurora-rss-reader/rss-desktop/src/components/settings/SettingsAIFeatures.vue)
  - 需从“布尔开关”升级为“默认规则配置”
- [DigestView.vue](/Users/Apple/Documents/githubs/aurora-rss-reader/rss-desktop/src/components/tags/DigestView.vue)
  - 后续需要支持基于 `citations` 的引用增强
- [tagsStore.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/rss-desktop/src/stores/tagsStore.ts)
  - digest 接口将逐步迁移到统一入口

### 10.2 会直接受影响的后端文件

- [ai.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/backend-node/src/routes/ai.ts)
  - 需拆出 entry 任务执行服务与配置解析
- [tags.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/backend-node/src/routes/tags.ts)
  - 需将 digest 生成逻辑下沉到统一 service
- [ai.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/backend-node/src/services/ai.ts)
  - 需增加结构化 JSON 输出辅助能力
- [userSettings.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/backend-node/src/services/userSettings.ts)
  - 继续保留，但不再承担所有自动化状态
- [init.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/backend-node/src/db/init.ts)
  - 需新增新表与迁移逻辑

## 十一、推荐实施顺序

### Step 1：先补底层模型

- 新增 `ai_automation_rules`
- 新增 `aggregate_digests`
- 新增 `aiAutomationResolver`
- 保持现有功能不变

### Step 2：接管文章级自动化

- 前端 [useEntryAI.ts](/Users/Apple/Documents/githubs/aurora-rss-reader/rss-desktop/src/composables/useEntryAI.ts) 从布尔值切到自动化规则解析
- 旧配置作为 fallback

### Step 3：统一 digest 执行层

- 新建 `aggregateDigest` service
- 让 `tag_digest` 先复用它

### Step 4：上线 feed/group digest

- 前端新增入口
- 后端统一使用 `aggregate_digest`

### Step 5：再做引用增强

- 基于 `summary_md + citations` 做摘要展示增强
- 这一阶段不需要重新生成旧摘要

## 十二、结论

本方案的关键选择如下：

- `feed_digest / group_digest / tag_digest` 统一为一个任务 `aggregate_digest`
- 聚合摘要输出采用 `summary_md + citations` 的最小结构
- 自动化规则单独建表，不继续往 `user_settings` 塞全局布尔
- 单篇文章摘要与聚合摘要共享模型配置，但不共享提示词和自动化判定
- 迁移优先走“兼容旧表，渐进替换”，避免一次性大爆炸

如果按这个方案实施，系统会从“多个功能点各自长逻辑”升级为“统一任务系统 + 统一自动化规则 + 可扩展展示层”，后续再加新任务时不会继续失控。
