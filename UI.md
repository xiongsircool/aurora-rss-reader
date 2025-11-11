# UI 设计基线 · RSS 管理 & AI 阅读器

> 目标：以 Folo/Folo is 的界面语言为参照，为 RSS 管理工具定义一个现代、轻量、情感化的 UI 规范，可直接交付给设计与前端协作。

---

## 1. 设计关键词

| 维度 | 取向 | 说明 |
| --- | --- | --- |
| 情绪 | **Focused Calm** | 去噪、柔和配色、简洁字重，突出「效率 + 陪伴」。 |
| 布局 | **Multi-Pane Timeline** | 左侧信息结构 + 中间时间线 + 右侧详情/AI，支持多屏尺寸。 |
| 品牌 | **Human-Tech Hybrid** | AI 能力可视化但不过度「炫技」，强调可信赖。 |
| 互动 | **Micro-motion** | 渐进式入场、轻微缩放/阴影，保持 200ms 内响应。 |
| 主题 | **Light / Dark 双主题** | 默认跟随系统，可快速切换。 |

---

## 2. 布局结构

```
┌───────────┬───────────────────────┬────────────┐
│ 左侧 Sidebar│ 中部 Feed Timeline    │ 右侧 Details│
│ 256~300px   │ 560~720px，自适应      │ 320~420px   │
└───────────┴───────────────────────┴────────────┘
```

1. **左侧栏（信息架构）**
   - 顶部：Logo + 工作区切换 + 用户头像。
   - 快捷筛选：全部/文章/视频/图片/社交等 Emoji + 数字徽标。
   - 列表：收藏、列表（List）、订阅源折叠组。使用 `12px` 标签字重 `600`。
   - 底部：设置、主题、下载入口。

2. **中部时间线**
   - Header：当前过滤条件 + 操作按钮（刷新、标为已读、筛选等）。
   - Item：三段式结构（来源图标 + 标题/摘要 + Meta）。整体点击打开详情。Hover 提升背景 & 左侧彩色圆点提示未读。
   - 分页：虚拟滚动 + 懒加载，保持 16px 行间距，条目高度 54~64px。

3. **右侧详情 / AI 面板**
   - 粘性顶部：标题 + 来源 + 操作菜单（收藏、分享、更多）。
   - 内容区：
     1. Hero 标题（28px/32px 行高）。
     2. Meta（作者、时间、标签、阅读时长）。
     3. 正文流。
   - AI Summary 卡片：玻璃拟态背景 + 渐变描边，可收起。
   - 辅助：Ask AI / 翻译 / 多语言切换浮动按钮。

4. **响应式断点**
   - `＞1440px`：三栏全显。
   - `1024~1440px`：右栏可折叠成抽屉。
   - `768~1024px`：仅侧栏 + 内容两栏。
   - `<768px`：Stack 布局，顶部 Tab 切换。

---

## 3. 视觉语言

### 3.1 颜色系统

| Token | Light | Dark | 用途 |
| --- | --- | --- | --- |
| `--bg-base` | `#F7F8FB` | `#0F1115` | 页面背景 |
| `--bg-surface` | `#FFFFFF` | `#181B22` | 卡片、浮层 |
| `--text-primary` | `#12141A` | `#F5F6FA` | 主文案 |
| `--text-secondary` | `#5F6370` | `#9BA1B3` | 次要信息 |
| `--border-muted` | `#E4E7ED` | `#2A2F3A` | 边框、分割线 |
| `--accent` | `#FF5C00` | `#FF8A3D` | 品牌/CTA（参考 Folo） |
| `--accent-soft` | `linear-gradient(120deg, #FF7A18, #FFBE30)` | 同上 | 高亮背景/图标 |
| `--info` | `#007AFF` | `#4DA1FF` | 信息按钮 |
| `--success` | `#34C759` | `#2DC06B` | 成功反馈 |
| `--warning` | `#FFB020` | `#FFC056` | 预警提示 |
| `--danger` | `#FF3B30` | `#FF6B60` | 错误状态 |

> 所有渐变、玻璃卡片需叠加 `--glass-blur: 20px`，透明度 0.8 以内，保持可读性。

### 3.2 字体 & 排版

- 基础：`font-family: "system-ui", -apple-system, BlinkMacSystemFont, "SF Pro", "Inter", sans-serif`。
- 标题：
  - `H1 28/36`（详情标题）。
  - `H2 22/30`（区块标题）。
  - `H3 18/26`（侧栏分组）。
- 正文：`14/22`（时间线、正文段落）。
- Meta/标签：`12/18` + 大写/半透明。
- 字重控制：避免 `900`；常用 `400/500/600`。

### 3.3 Icon & 图形

- 使用线性 Icon（如 MingCute / Lucide），圆角 2px。
- 来源图标：32px 圆角方块 + 渐变背景 + 白色首字母。
- 状态点：8px 圆点 + 自定义颜色映射（AI、警告等）。

---

## 4. 核心组件规范

### 4.1 Sidebar 模块

- **Group Header**：12px 小字，字母间距 `0.12em`。
- **Feed Item**：
  - 左 Icon + Feed 名称（单行截断）。
  - 右侧数量徽标（灰底/橙底，圆角 8px，12px 字号）。
  - Hover：`background: rgba(0,0,0,0.03)` + `border-left: 2px accent`。
  - Active：填充 `--bg-surface` + 加粗 + 左侧彩条。

### 4.2 Timeline Item

| 区块 | 规格 |
| --- | --- |
| 容器 | `padding: 12px 16px`, `border-radius: 12px`, `gap: 12px` |
| 左侧 | 16px 图标 + 渐变背景，或 Feed favicon |
| 主内容 | 标题 `14/22` + 摘要 `13/20`，溢出截断 |
| Meta | 时间、标签（chip）、未读点；使用 flex 右对齐 |
| Interactive | Hover 抬升阴影 `0 12px 24px rgba(15,17,21,0.05)`，Active 缩放 0.995 |

### 4.3 详情视图

1. **Hero Header**：标题 + 标签 Chip（透明底，描边 1px）。
2. **Meta Bar**：作者、来源、发布时间、阅读时长、原文链接按钮。
3. **AI 卡片**：
   - 背景：半透明 + 渐变描边，圆角 20px。
   - Header：AI 图标 + 文本 “AI 总结/AI Copilot”。
   - 内容：12~14px 文案，最多 5 行显示，支持展开。
   - Action：复制、刷新、语种切换按钮。
4. **正文**：`max-width: 65ch`，使用 `prose` 样式（段前 0，段后 16px）。
5. **浮动 CTA**：右下角 Ask AI 按钮（圆角 999px）。

### 4.4 系统组件

- **搜索/命令面板**：全屏蒙层，中心 720px 宽白色卡片；使用 Command + P 呼出。列表项 48px 高度。
- **Toast / Notification**：使用 Sonner 风格，自定义主题；位置右上。Icon + 标题 + 描述 +按钮。
- **Modal**：16px 圆角，顶部彩色进度条表示步骤。
- **空状态**：插画 + 引导链接 + 快捷按钮（例如「添加订阅源」）。
- **加载**：Lottie 或 spinner + 骨架屏；时间线、详情、AI 等分别提供 skeleton。

---

## 5. 交互与动画

| 场景 | 动画 | 备注 |
| --- | --- | --- |
| 主题切换 | 150ms 渐变 + 背景过渡 | 使用 CSS variables，实现闪烁最小化 |
| 菜单 & Popover | Scale 0.98 → 1, 120ms | 阴影从 8 → 16 blur |
| Timeline 滚动 | 粘性 Header + Scrollbar 隐藏 | 保持性能，虚拟列表 |
| AI Summary 展开 | 高度渐变 + 淡入 200ms | Expand button icon 旋转 180° |
| Toast 进出 | TranslateY + Fade 350ms | 参考 Sonner 默认 |

> 所有动画默认 `cubic-bezier(0.16, 1, 0.3, 1)`。

---

## 6. 状态与反馈

1. **未读**：左侧彩点 + Timeline 高亮；点击后淡化。
2. **同步中**：顶部 Banner（info色）+ 右上角旋转 Icon。
3. **错误**：红色 toast + 详情页提醒模块，提供重试按钮。
4. **AI 任务**：
   - 队列状态：AI 卡片显示「分析中…」+ 进度条。
   - 失败重试：按钮 + 文案提示（例如「请检查 API Key」）。
5. **导入/导出**：进度条 + Stepper；完成后展示统计摘要。

---

## 7. 文案与语气

- Tone：专业但亲和，使用短句；中英文混用时保持大小写规范。
- 典型 copy：
  - 空状态：`「这里还没有订阅，去发现一些新来源吧」`。
  - AI 卡片：`「AI 总结 · 34 秒前更新」`。
  - 操作按钮：`「标记为已读」「稍后再看」「翻译成英文」`。

---

## 8. 资源与交付

1. **设计稿**：Figma 文件，遵循 8px 网格；组件库命名 `RUI/Component/Variant`。
2. **主题变量**：输出 JSON/Tokens（Style Dictionary）。
3. **插画/Icon**：使用抽象线稿 + 品牌颜色；AI 相关使用粒子/网格。
4. **字体资产**：默认系统字体，无需额外加载；若使用 SF Pro，请在桌面端准备 fallback。

---

## 9. 未来扩展

- 自定义主题（用户可选择品牌色、背景纹理）。
- Sidebar 缩略模式（仅图标）。
- 多窗口布局（参考 Notion split view）。
- AI 指南针：在右栏加入「快速问答」「自动标签」等扩展卡片。

---

> **交付建议**：先在 Figma 搭建多主题基础组件，再衍生实例页面（Dashboard、Feed List、Entry Detail、Settings、AI Workspace）。前端可据此提炼为 `tokens + Tailwind CSS` 或 `CSS Vars + Radix UI` 的组件体系。

---

## 10. 实现思路（Design → Dev）

在正式开工前，可按以下路径把设计资产落地成可复用的实现方案：

1. **Design Tokens**  
   - 依据第 3 章的色彩/排版，产出 `tokens.json`（或 Style Dictionary）。  
   - 覆盖颜色、字体、字号、圆角、阴影、间距、渐变等，确保主题切换时只改变量。  
   - 前端落地：CSS Variables（`--bg-base` 等）+ `@layer tokens`（Tailwind）或 `vanilla-extract`。

2. **组件分层**  
   - 原子：Button、IconButton、Chip、Badge、Toggle、Input、Textarea。  
   - 分子：FeedItem、TimelineCard、AI Summary Card、ModalHeader。  
   - 有机体：Sidebar、TimelineList（虚拟滚动）、DetailsPane、SettingsModal。  
   - 在 Figma 中将 SVG 线框拆成组件，再导出到代码库（Storybook / Ladle）进行可视化对齐。

3. **交互状态**  
   - 统一 hover/active/disabled 的动效（200ms、`cubic-bezier(0.16, 1, 0.3, 1)`）。  
   - Skeleton：时间线（条状）、详情正文（文本）、AI 卡片（玻璃底）。  
   - Toast / Banner：定义信息密度 + 文案模板，例如导入失败、AI Key 缺失等。

4. **响应式实现**  
   - 栅格：1200px 基准，8px spacing grid。  
   - 断点：`≥1440` 三栏、`1024-1439` 折叠右栏、`768-1023` 两栏、`<768` 单栏。  
   - Sidebar 提供「icon-only」模式；Settings 弹窗在移动端改为全屏抽屉。

5. **状态管理/数据流**  
   - Timeline 建议使用虚拟列表（React Window / Virtuoso），避免大数据量卡顿。  
   - Settings Modal 与导入流程：采用状态机或 `tanstack/query` + `zustand`，区分 `idle → validating → importing → done/error`。  
   - AI Summary：使用任务队列 + 乐观 UI，展示「分析中…」「重试」等状态。

6. **文案与多语言**  
   - 抽离所有 UI 文案到 `locales/`，按「系统/提示/按钮/错误」分类。  
   - 先准备简体中文 + 英文，配合 `Intl.DateTimeFormat` 格式化日期。  
   - 对话框内的快捷键信息（Esc / ⌘+Enter）写在配置文件，便于后续扩展。

通过以上步骤，设计稿与代码实现可以形成统一的“设计系统 → 组件库 → 应用”流水线，后续扩展（暗色主题、插件化面板等）也只需在 tokens/组件层做增量即可。

---

## 附录 · SVG 布局草图

为方便快速预览主要页面编排，仓库下新增 `designs/layouts/` 目录，包含三份 SVG 线框图，可直接在浏览器中打开：

| 文件 | 场景 | 说明 |
| --- | --- | --- |
| `designs/layouts/timeline.svg` | 时间线主视图 | 展示左侧订阅、中部时间线、右侧详情/AI 三栏结构。 |
| `designs/layouts/settings-modal.svg` | 设置 / 导入弹窗 | 描述在本地应用中使用的多 Tab 设置与导入流程对话框。 |

后续如需生成新的布局，只需在同目录内新增 SVG（保持 1200×720 画布），即可快速分享给协作同伴。
