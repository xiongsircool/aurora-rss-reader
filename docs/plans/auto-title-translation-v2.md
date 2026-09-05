# 自动标题翻译 V2 设计（视口驱动）

日期：2026-09-05
状态：待实现
前置：V1 调研结论（本文档第一节）

---

## 一、V1 为什么失败（调研结论）

### 根因：设置存储分裂，开关永远读不到

| 角色 | 存储位置 | Key |
|---|---|---|
| 设置页「请求策略」（写入） | SharedPreferences | `ai_settings` |
| controller `_loadAutoTranslateSettings()`（读取） | SQLite `app_prefs` 表 | `ai_extended_settings` |

**两边永远不同步。** controller 里 `_autoTranslateTitles` 恒为 `false`，
`_autoTranslatePendingTitles()` 第一行直接 return——**自动翻译从未真正执行过**。
用户手动点「翻译标题」走的是 `translateTitle()` 直调，不经过开关，所以只有手动翻的才显示。

### V1 的其他缺陷（即使修好存储也依然存在）

| # | 缺陷 | 后果 |
|---|---|---|
| 1 | 按已加载列表前 N 条翻译，与用户滚动位置无关 | 翻译的不是正在看的 |
| 2 | 翻译完 `_loadFirstPage()` 重载列表 | 滚动位置跳回顶部 |
| 3 | 失败不缓存 | 同一条反复重试，浪费配额 |
| 4 | 无并发锁 | loadMore 与上一轮同时跑，重复翻译 |
| 5 | 每条翻译都重新读 AI 配置 + API Key | 10 条 = 10 次配置读取 |
| 6 | 硬编码 `language = 'zh'`（JOIN 和提示词） | 「输出语言」设置对标题无效 |

### 业界参照

- **沉浸式翻译 / Safari 翻译**：所见即所翻，双语对照，原文永远保留
- **Inoreader / FeedMe**：按需手动翻译，不做自动（怕配额失控）
- **共同模式**：翻译跟随「用户注意力」，结果以双语形式静默出现

---

## 二、V2 设计

### 核心原则

1. **单一事实源**：AI 设置只存 SharedPreferences `ai_settings`，controller 直接读它
2. **视口驱动**：条目进入屏幕才翻译（所见即所翻），不做批量预热
3. **原地更新**：翻译完成只改内存中对应 Entry，绝不重载列表
4. **三重防抖**：去重集合 + 失败负缓存 + 主开关

### 2.1 触发机制（可见性 = 构建时机）

`ListView.builder` 只会构建即将进入屏幕的条目——**条目被构建本身就是
「即将可见」的信号**，无需额外插件：

```dart
// entry_tile.dart
class EntryTile extends StatefulWidget { ... }

class _EntryTileState extends State<EntryTile> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // 构建完成 ≈ 已在视口或即将滚入视口
      widget.controller.requestTitleTranslation(widget.entry.id);
    });
  }
  ...
}
```

- 用户往上回滚 → 已有 `translatedTitle` → `requestTitleTranslation` 直接跳过
- 主开关关闭 → 直接跳过（一行判断，零成本）

### 2.2 controller 调度器（新增 ~60 行，删除 ~40 行）

```dart
// ── 状态 ──────────────────────────────
final Set<String> _titleTxFlying = {};     // 进行中，防重复
final Map<String, DateTime> _titleTxFailed = {}; // 失败负缓存
static const _titleTxRetryBackoff = Duration(minutes: 10);

// AI 配置缓存（避免每条都读）
_AiTxCfg? _titleTxCfg;

// ── 唯一入口 ──────────────────────────
Future<void> requestTitleTranslation(String entryId) async {
  if (!_autoTranslateTitles) return;                    // 主开关
  final entry = _entryById(entryId);
  if (entry == null || entry.translatedTitle != null) return; // 已翻
  if (_titleTxFlying.contains(entryId)) return;         // 进行中
  final failedAt = _titleTxFailed[entryId];
  if (failedAt != null &&
      DateTime.now().difference(failedAt) < _titleTxRetryBackoff) {
    return;                                             // 负缓存期内
  }
  if (_titleTxFlying.length >= 3) return;               // 并发上限
  _titleTxFlying.add(entryId);
  try {
    final cfg = await _ensureTitleTxCfg();             // 读一次缓存复用
    if (cfg == null) return;                           // AI 未配置
    final targetLang = _targetLang();                  // 跟随输出语言设置
    if (!shouldTranslate(
        entry.sourceLang ?? detectSourceLang(entry.title),
        targetLang)) return;                           // 同语言跳过
    final result = await _translateTitleWith(cfg, entry.title, targetLang);
    if (result == null) {
      _titleTxFailed[entryId] = DateTime.now();        // 失败记负缓存
      return;
    }
    _updateEntryInPlace(entryId, translatedTitle: result); // 原地更新
  } finally {
    _titleTxFlying.remove(entryId);
  }
}

void _updateEntryInPlace(String id, {required String translatedTitle}) {
  final i = _entries.indexWhere((e) => e.id == id);
  if (i < 0) return;
  _entries[i] = _entries[i].copyWith(translatedTitle: translatedTitle);
  notifyListeners();  // 只刷新这一项，不重载、不跳滚动
}
```

### 2.3 存储修复

```dart
Future<void> _loadAutoTranslateSettings() async {
  // 直接读 SharedPreferences，与设置页同一 key
  final sp = await SharedPreferences.getInstance();
  final raw = sp.getString('ai_settings');
  final prefs = raw == null ? null : jsonDecode(raw) as Map<String, dynamic>;
  _autoTranslateTitles = prefs?['autoTranslateTitles'] as bool? ?? false;
  _targetLangCode = prefs?['language'] as String? ?? 'zh';
}
```

删除 `ReaderPrefsRepository.loadAiExtendedSettings` 的调用链
（方法保留但不再使用，避免破坏其他引用）。

### 2.4 语言跟随「输出语言」

- `translateTitle` 提示词使用 `_targetLangCode`（zh/en/ja/ko）
- `listInbox` 的 JOIN 参数化：`t.language = ?` 传入目标语言
- 缓存表 translations 本来就按 `language` 区分，无需迁移
- 用户切换输出语言 → 列表重新查询，显示对应语言的翻译

### 2.5 UX 呈现（不突兀）

| 场景 | 表现 |
|---|---|
| 翻译中 | **什么都不显示**（1-3 秒延迟不值得加 loading 噪音） |
| 翻译完成 | 原标题下方淡入灰色小字译文（现有样式，保持） |
| 失败 | 静默，10 分钟后该条目再次可见时自动重试 |
| 中文文章 | 永远不出现译文（source_lang 检测） |
| 关闭开关 | 已翻译的保留显示，新的不再翻译 |

### 2.6 删除的 V1 代码

- `_autoTranslatePendingTitles()` 整个方法
- `initialize()` / `loadMore()` / `refreshAll()` 中的触发点（视口回调取代）
- 设置页「每次翻译上限」滑块（视口驱动天然限流：同时最多 3 个在途）
- `_maxAutoTranslations` 字段

### 2.7 保留的 V1 代码

- `translateTitle()` 的缓存读写与 AI 调用（改为接受 cfg + lang 参数）
- `translations` 表结构（已按语言区分）
- 入库时 `source_lang` 检测
- EntryTile 双语显示样式

---

## 三、风险评估

| 风险 | 缓解 |
|---|---|
| 回滚重建 tile 重复触发 | `translatedTitle != null` 一行判断挡掉 |
| notifyListeners 频繁 | 每条完成才调一次，3 并发下频率极低 |
| ListView 虚拟化导致 index 变化 | 用 `indexWhere(id)` 按 id 查找，不依赖下标 |
| AI 未配置时静默失败 | 保留现有「翻译标题」手动入口兜底 |
| 旧文章 source_lang 为 NULL | 已有 `?? detectSourceLang(title)` 兜底 |

## 四、改动文件清单

| 文件 | 改动 |
|---|---|
| `mobile_reader_controller.dart` | 重写调度器（+60/-40 行） |
| `entry_tile.dart` | initState 加可见性回调（+8 行） |
| `local_content_repository.dart` | JOIN 语言参数化（+2 行） |
| `ai_settings_sheet.dart` | 删「每次翻译上限」滑块（-15 行） |

预计总量 < 130 行变更，单次提交可完成，62 项现有测试无需改动即应通过。
