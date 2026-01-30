# 功能工作台 & 收藏夹系统开发计划

> 创建时间: 2026-01-30
> 状态: 进行中

## 一、项目概述

### 1.1 目标
为 Aurora RSS Reader 添加一个独立的"功能工作台"页面，首个功能模块为"多文件夹收藏系统"，为后续扩展功能（AI博客生成、邮件分享等）奠定基础。

### 1.2 核心功能
- **功能工作台页面**: 独立于阅读器的新页面，通过拼图图标切换
- **多文件夹系统**: 用户可创建多个收藏夹，通过右键菜单将文章添加到指定文件夹
- **模块化架构**: 方便后续扩展更多功能模块

### 1.3 设计原则
- 交互层与逻辑层分离（桌面右键/移动长按统一处理）
- 模块化设计，功能可插拔
- API 优先，后端设计好便于多端复用
- 渐进增强，核心功能先行

---

## 二、技术架构

### 2.1 数据库设计

```sql
-- 收藏夹表
CREATE TABLE collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT DEFAULT 'folder',
    color TEXT DEFAULT '#ff7a18',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 收藏夹-文章关联表
CREATE TABLE collection_entries (
    collection_id TEXT NOT NULL,
    entry_id TEXT NOT NULL,
    added_at TEXT DEFAULT CURRENT_TIMESTAMP,
    note TEXT,
    PRIMARY KEY (collection_id, entry_id),
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
);

CREATE INDEX idx_collection_entries_collection ON collection_entries(collection_id);
CREATE INDEX idx_collection_entries_entry ON collection_entries(entry_id);
```

### 2.2 API 设计

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/collections | 获取所有收藏夹 |
| POST | /api/collections | 创建收藏夹 |
| PUT | /api/collections/:id | 更新收藏夹 |
| DELETE | /api/collections/:id | 删除收藏夹 |
| GET | /api/collections/:id/entries | 获取收藏夹内文章 |
| POST | /api/collections/:id/entries | 添加文章到收藏夹 |
| DELETE | /api/collections/:id/entries/:entryId | 移除文章 |
| GET | /api/entries/:id/collections | 获取文章所属收藏夹 |

### 2.3 前端文件结构

```
src/
├── composables/
│   ├── useContextMenu.ts        # 统一上下文菜单 Hook
│   └── useEntryActions.ts       # 文章操作 Hook
├── stores/
│   ├── collectionsStore.ts      # 收藏夹状态管理
│   └── workspaceStore.ts        # 工作台状态
├── components/
│   ├── common/
│   │   └── ContextMenu.vue      # 通用右键菜单
│   ├── collections/
│   │   ├── AddToCollectionModal.vue
│   │   ├── CollectionList.vue
│   │   └── CollectionDetail.vue
│   └── workspace/
│       ├── WorkspaceHeader.vue
│       └── WorkspaceNav.vue
└── views/
    └── WorkspaceView.vue
```

---

## 三、开发阶段

### Phase 1: 基础架构 ⬜

#### 1.1 后端 - 数据库
- [ ] 创建 collections 表
- [ ] 创建 collection_entries 表
- [ ] 添加索引

#### 1.2 后端 - Repository
- [ ] 创建 `backend-node/src/db/repositories/collections.ts`
- [ ] 实现 CRUD 操作

#### 1.3 后端 - API 路由
- [ ] 创建 `backend-node/src/routes/collections.ts`
- [ ] 注册路由到 main.ts

#### 1.4 前端 - Store
- [ ] 创建 `collectionsStore.ts`
- [ ] 实现状态管理和 API 调用

#### 1.5 前端 - 通用组件
- [ ] 创建 `useContextMenu.ts` composable
- [ ] 创建 `ContextMenu.vue` 通用组件

#### 1.6 前端 - 文章右键菜单
- [ ] 修改 `EntryCard.vue` 添加右键菜单
- [ ] 实现"添加到收藏夹"功能
- [ ] 创建 `AddToCollectionModal.vue`

### Phase 2: 工作台页面 ⬜

#### 2.1 路由配置
- [ ] 添加 `/workspace` 路由
- [ ] 创建 `WorkspaceView.vue`

#### 2.2 Header 切换按钮
- [ ] 在 `SidebarHeader.vue` 添加拼图图标按钮
- [ ] 实现页面切换逻辑

#### 2.3 工作台布局
- [ ] 创建 `WorkspaceHeader.vue`
- [ ] 创建 `WorkspaceNav.vue`（功能导航）

#### 2.4 收藏夹模块
- [ ] 创建 `CollectionList.vue`
- [ ] 创建 `CollectionDetail.vue`
- [ ] 实现收藏夹管理（创建/编辑/删除）

### Phase 3: 完善与优化 ⬜

#### 3.1 状态保持
- [ ] 实现 `workspaceStore.ts`
- [ ] 页面切换时保持状态

#### 3.2 响应式适配
- [ ] 小屏幕使用 ActionSheet 替代右键菜单
- [ ] 工作台页面响应式布局

#### 3.3 国际化
- [ ] 添加中英文翻译

### Phase 4: 预留扩展 ⬜

> 以下为后续功能，本次不实现

- [ ] AI 博客生成模块
- [ ] 邮件分享模块
- [ ] 数据统计模块

---

## 四、UI 设计

### 4.1 切换按钮位置

```
┌─────────────────────────────────────────────────────────┐
│ [Logo] Aurora RSS Reader     [🧩] [🌙] [⚙️] [📐]       │
│                               ↑                         │
│                          新增：切换到工作台              │
└─────────────────────────────────────────────────────────┘
```

### 4.2 文章右键菜单

```
┌─────────────────────────┐
│ 📖 标记为已读/未读       │
│ ⭐ 收藏/取消收藏         │
├─────────────────────────┤
│ 📁 添加到收藏夹 →       │
├─────────────────────────┤
│ 🔗 复制链接             │
│ 🌐 在浏览器中打开        │
└─────────────────────────┘
```

### 4.3 工作台页面布局

```
┌─────────────────────────────────────────────────────────┐
│  [Logo] 功能工作台              [📰返回] [🌙] [⚙️]     │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────────────────────────────────┐  │
│  │ 功能导航 │  │                                     │  │
│  │         │  │     动态加载的功能模块内容            │  │
│  │ 📁 收藏夹│  │                                     │  │
│  │ 📝 博客  │  │                                     │  │
│  │ 📧 分享  │  │                                     │  │
│  │         │  │                                     │  │
│  └─────────┘  └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 五、注意事项

1. **向后兼容**: 不影响现有的收藏（starred）功能
2. **数据安全**: 删除收藏夹时级联删除关联，但不删除文章本身
3. **性能考虑**: 收藏夹列表使用虚拟滚动（如果数量多）
4. **错误处理**: API 调用失败时显示友好提示

---

## 六、验收标准

### Phase 1 完成标准
- [ ] 可以通过右键菜单将文章添加到收藏夹
- [ ] 可以创建新收藏夹
- [ ] 数据正确存储到数据库

### Phase 2 完成标准
- [ ] 点击拼图图标可切换到工作台页面
- [ ] 工作台显示收藏夹列表
- [ ] 可以查看收藏夹内的文章
- [ ] 可以管理收藏夹（编辑/删除）

### Phase 3 完成标准
- [ ] 页面切换时状态保持
- [ ] 小屏幕适配正常
- [ ] 中英文切换正常
