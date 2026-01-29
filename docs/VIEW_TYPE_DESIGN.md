# View Type 分类功能设计方案

## 概述

参考 Folo RSS Reader 的设计，为 Aurora RSS Reader 引入订阅源类型分类功能。类型作为一级分类入口，用户可以按类型浏览不同形式的内容。

## 类型定义

| 类型 | 标识 | 图标 | 典型来源 | 展示特点 |
|------|------|------|----------|----------|
| Articles | `articles` | 📄 | 博客、新闻网站 | 标题 + 摘要 + 时间（默认类型） |
| Social | `social` | 💬 | Twitter/X、Mastodon | 头像 + 全文 + 互动信息 |
| Pictures | `pictures` | 🖼️ | Instagram、图片站 | 网格/瀑布流布局 |
| Videos | `videos` | 🎬 | YouTube、B站 | 大缩略图 + 时长 |
| Audio | `audio` | 🎧 | 播客 RSS | 封面 + 时长 + 播放控件 |
| Notifications | `notifications` | 🔔 | GitHub、服务通知 | 紧凑列表 |

## 兼容性设计

**重要**：`articles` 为默认类型，确保旧数据平滑迁移：
- 数据库迁移时，所有现有订阅源的 `view_type` 设为 `'articles'`
- 新增订阅时自动识别类型，识别失败则默认为 `'articles'`
- 用户可通过右键菜单手动修改类型

## 数据模型变更

### feeds 表新增字段

```sql
ALTER TABLE feeds ADD COLUMN view_type TEXT NOT NULL DEFAULT 'articles';
```

### TypeScript 类型定义

```typescript
type ViewType = 'articles' | 'social' | 'pictures' | 'videos' | 'audio' | 'notifications';

interface Feed {
  // ... 现有字段
  view_type: ViewType;
}
```

## 自动识别规则

### URL 匹配规则

| URL 特征 | 识别为 |
|----------|--------|
| `youtube.com`, `bilibili.com`, `vimeo.com` | videos |
| `twitter.com`, `x.com`, `mastodon`, `weibo.com` | social |
| `instagram.com`, `flickr.com`, `unsplash.com` | pictures |
| `github.com/*/notifications`, `gitlab.com` | notifications |

### RSS 内容分析规则

| 特征 | 识别为 |
|------|--------|
| `<enclosure type="audio/...">` | audio |
| `<media:content type="video/...">` | videos |
| 条目内容以图片为主 | pictures |
| 都不匹配 | articles（默认） |

## 后端 API 变更

### 1. GET /feeds

返回值增加 `view_type` 字段。

### 2. POST /feeds

- 自动识别 `view_type`
- 返回值包含识别结果

### 3. PUT /feeds/:id

- 支持更新 `view_type` 字段
- 用于用户手动修改类型

### 4. GET /entries

新增查询参数：
```
GET /entries?view_type=videos
```
返回指定类型下所有订阅源的文章。

## 前端 Store 变更

### feedStore 新增状态

```typescript
// 当前选中的类型
const activeViewType = ref<ViewType>('articles')

// 当前类型下的订阅源
const filteredFeeds = computed(() => {
  return feeds.value.filter(f => f.view_type === activeViewType.value)
})

// 当前类型下按分组归类
const filteredGroupedFeeds = computed(() => {
  const groups: Record<string, Feed[]> = {}
  filteredFeeds.value.forEach(feed => {
    const groupName = feed.group_name || '未分组'
    if (!groups[groupName]) groups[groupName] = []
    groups[groupName].push(feed)
  })
  return groups
})
```

### 各类型统计

```typescript
const viewTypeStats = computed(() => {
  const stats: Record<ViewType, { count: number; unread: number }> = {}
  VIEW_TYPES.forEach(type => {
    const typeFeeds = feeds.value.filter(f => f.view_type === type)
    stats[type] = {
      count: typeFeeds.length,
      unread: typeFeeds.reduce((sum, f) => sum + (f.unread_count || 0), 0)
    }
  })
  return stats
})
```

## 前端 UI 变更

### 侧边栏结构

```
┌─────────────────────────┐
│ 📄  💬  🖼️  🎬  🎧  🔔   │  ← ViewTypeNav 组件
│ (12) (3) (0) (5) (2) (1)│  ← 各类型未读数
├─────────────────────────┤
│ 当前: Articles          │
├─────────────────────────┤
│ ⭐ 收藏夹                │
├─────────────────────────┤
│ 📁 分组A                 │  ← 只显示当前类型下的
│   ├── 订阅1              │
│   └── 订阅2              │
└─────────────────────────┘
```

### 新增组件

```
src/components/
├── sidebar/
│   └── ViewTypeNav.vue      # 类型导航栏
├── timeline/
│   ├── EntryCard.vue        # 现有，作为 Articles 默认
│   ├── VideoCard.vue        # 视频类型卡片
│   ├── SocialCard.vue       # 社交类型卡片
│   ├── PictureCard.vue      # 图片类型卡片
│   ├── AudioCard.vue        # 音频类型卡片
│   ├── NotificationCard.vue # 通知类型卡片
│   └── PictureGrid.vue      # 图片网格布局
```

## 用户操作流程

### 1. 添加订阅

```
用户输入 URL → 后端解析 → 自动识别类型 → 保存
                                ↓
                    返回识别结果给前端显示
```

### 2. 修改订阅类型（右键菜单）

```
用户右键订阅源 → 选择"修改类型" → 弹出类型选择
                                    ↓
              选择新类型 → PUT /feeds/:id → 更新成功
                                    ↓
                    订阅源移动到新类型分类下
```

### 3. 切换类型视图

```
用户点击类型图标（如 🎬）
        ↓
activeViewType = 'videos'
        ↓
侧边栏过滤：只显示 videos 类型的订阅源
        ↓
文章列表：加载 videos 类型的文章，使用 VideoCard 渲染
```

## 实施阶段

### Phase 1: 基础架构
- [ ] 数据库增加 view_type 字段
- [ ] 数据迁移（现有数据设为 articles）
- [ ] 后端 API 支持 view_type

### Phase 2: 自动识别
- [ ] URL 匹配规则实现
- [ ] RSS 内容分析规则实现

### Phase 3: 前端基础
- [ ] feedStore 扩展 view_type 状态
- [ ] ViewTypeNav 组件
- [ ] 侧边栏按类型过滤

### Phase 4: 右键菜单
- [ ] 订阅源右键菜单增加"修改类型"选项
- [ ] 类型选择弹窗组件

### Phase 5: 差异化卡片（可选）
- [ ] VideoCard 组件
- [ ] SocialCard 组件
- [ ] PictureCard + PictureGrid 组件
- [ ] AudioCard 组件
- [ ] NotificationCard 组件

## 注意事项

1. **向后兼容**：默认类型为 `articles`，确保升级不影响现有用户
2. **渐进增强**：先实现类型切换，卡片差异化可后续迭代
3. **用户可控**：自动识别 + 手动修改，给用户最终控制权
