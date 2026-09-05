import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../platform/background/background_refresh.dart';

import '../../data/repositories/local_content_repository.dart'
    show GroupSummary;
import '../../domain/entities/entry.dart';
import '../../domain/entities/feed.dart';
import '../inbox/entry_tile.dart';
import '../inbox/inbox_filter_sheet.dart';
import '../reader/article_reader_page.dart';
import '../reader/mobile_reader_controller.dart';
import '../search/search_page.dart';
import '../settings/ai_settings_sheet.dart';
import '../settings/opml_actions_sheet.dart';
import '../settings/proxy_settings_dialog.dart';
import '../sources/add_feed_sheet.dart';
import '../sources/group_picker.dart';

final class AuroraShell extends StatefulWidget {
  const AuroraShell({required this.controller, super.key});

  final MobileReaderController controller;

  @override
  State<AuroraShell> createState() => _AuroraShellState();
}

class _AuroraShellState extends State<AuroraShell> {
  int _selectedIndex = 0;

  static const _destinations = <NavigationDestination>[
    NavigationDestination(
      icon: Icon(Icons.inbox_outlined),
      selectedIcon: Icon(Icons.inbox),
      label: '收件箱',
    ),
    NavigationDestination(
      icon: Icon(Icons.bookmark_border),
      selectedIcon: Icon(Icons.bookmark),
      label: '收藏',
    ),
    NavigationDestination(
      icon: Icon(Icons.rss_feed_outlined),
      selectedIcon: Icon(Icons.rss_feed),
      label: '订阅',
    ),
    NavigationDestination(
      icon: Icon(Icons.settings_outlined),
      selectedIcon: Icon(Icons.settings),
      label: '设置',
    ),
  ];

  @override
  void initState() {
    super.initState();
    widget.controller.initialize();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.controller,
      builder: (context, _) {
        return Scaffold(
          body: IndexedStack(
            index: _selectedIndex,
            children: [
              _InboxPage(
                controller: widget.controller,
                onAddSource: _showAddFeed,
              ),
              _SavedPage(controller: widget.controller),
              _SourcesPage(
                controller: widget.controller,
                onAddSource: _showAddFeed,
              ),
              _SettingsPage(controller: widget.controller),
            ],
          ),
          bottomNavigationBar: NavigationBar(
            selectedIndex: _selectedIndex,
            destinations: _destinations,
            onDestinationSelected: _select,
          ),
        );
      },
    );
  }

  void _select(int index) {
    setState(() => _selectedIndex = index);
  }

  Future<void> _showAddFeed() async {
    await showAddFeedSheet(context, widget.controller);
    if (mounted && widget.controller.entries.isNotEmpty) {
      setState(() => _selectedIndex = 0);
    }
  }
}

final class _InboxPage extends StatelessWidget {
  const _InboxPage({required this.controller, required this.onAddSource});

  final MobileReaderController controller;
  final VoidCallback onAddSource;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Builder(
          builder: (context) {
            final now = DateTime.now();
            final hour = now.hour;
            final greeting = hour < 6
                ? '夜深了'
                : hour < 12
                ? '早上好'
                : hour < 14
                ? '中午好'
                : hour < 18
                ? '下午好'
                : '晚上好';
            const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
            final unread = controller.unreadCount;
            final subtitle =
                '${now.month}月${now.day}日 '
                '${weekdays[now.weekday - 1]}'
                '${unread > 0 ? ' · $unread 篇未读' : ' · 已全部读完'}';
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(greeting),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            );
          },
        ),
        actions: [
          IconButton(
            tooltip: '筛选',
            onPressed: () => showInboxFilterSheet(context, controller),
            icon: Stack(
              clipBehavior: Clip.none,
              children: [
                const Icon(Icons.filter_list),
                if (controller.mutedGroups.isNotEmpty)
                  Positioned(
                    right: -4,
                    top: -2,
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.primary,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          IconButton(
            tooltip: '搜索',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => SearchPage(controller: controller),
              ),
            ),
            icon: const Icon(Icons.search),
          ),
          IconButton(
            tooltip: '刷新全部订阅',
            onPressed: controller.refreshing || controller.feeds.isEmpty
                ? null
                : controller.refreshAll,
            icon: controller.refreshing
                ? const SizedBox.square(
                    dimension: 20,
                    child: CircularProgressIndicator(strokeWidth: 2.2),
                  )
                : const Icon(Icons.refresh),
          ),
          PopupMenuButton<String>(
            key: const ValueKey('inbox-more'),
            tooltip: '更多',
            onSelected: (action) async {
              if (action == 'mark-all-read') {
                final count = await controller.markInboxRead();
                if (context.mounted) {
                  ScaffoldMessenger.of(context)
                      .showSnackBar(SnackBar(content: Text('已标记 $count 篇为已读')));
                }
              }
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                value: 'mark-all-read',
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.done_all_outlined),
                  title: const Text('全部标为已读'),
                ),
              ),
            ],
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _StatusBanner(controller: controller),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),
              child: SegmentedButton<int>(
                segments: const [
                  ButtonSegment(value: 0, label: Text('全部')),
                  ButtonSegment(value: 1, label: Text('未读')),
                ],
                selected: {controller.unreadOnly ? 1 : 0},
                onSelectionChanged: (selection) {
                  controller.setUnreadOnly(selection.single == 1);
                },
              ),
            ),
            Expanded(child: _inboxContent(context)),
          ],
        ),
      ),
    );
  }

  Widget _inboxContent(BuildContext context) {
    if (controller.loading && !controller.initialized) {
      return const Center(child: CircularProgressIndicator());
    }
    if (controller.entries.isEmpty) {
      final noFeeds = controller.feeds.isEmpty;
      return _EmptyState(
        icon: controller.unreadOnly
            ? Icons.mark_email_read_outlined
            : Icons.inbox_outlined,
        title: controller.unreadOnly
            ? '没有未读文章'
            : noFeeds
            ? '收件箱为空'
            : '还没有获取到文章',
        actionLabel: noFeeds ? '添加订阅' : '刷新订阅',
        actionIcon: noFeeds ? Icons.add : Icons.refresh,
        onAction: noFeeds ? onAddSource : controller.refreshAll,
      );
    }

    return RefreshIndicator(
      onRefresh: controller.refreshAll,
      child: ListView.separated(
        key: const PageStorageKey('inbox-list'),
        physics: const AlwaysScrollableScrollPhysics(),
        itemCount: controller.entries.length + (controller.hasMore ? 1 : 0),
        separatorBuilder: (_, _) => const Divider(height: 1),
        itemBuilder: (context, index) {
          if (index == controller.entries.length) {
            return Padding(
              padding: const EdgeInsets.all(16),
              child: Center(
                child: TextButton.icon(
                  onPressed: controller.loadingMore
                      ? null
                      : controller.loadMore,
                  icon: controller.loadingMore
                      ? const SizedBox.square(
                          dimension: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.expand_more),
                  label: const Text('加载更多'),
                ),
              ),
            );
          }
          final entry = controller.entries[index];
          return EntryTile(
            key: ValueKey(entry.id),
            entry: entry,
            feedTitle: controller.feedTitle(entry.feedId),
            referer: controller.feedUrl(entry.feedId),
            onTap: () => _openReader(context, controller, entry),
            onVisible: () => controller.requestTitleTranslation(entry.id),
            onReadChanged: (read) => controller.setRead(entry, read: read),
            onStarredChanged: (starred) =>
                controller.setStarred(entry, starred: starred),
          );
        },
      ),
    );
  }
}

final class _SavedPage extends StatelessWidget {
  const _SavedPage({required this.controller});

  final MobileReaderController controller;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('收藏')),
      body: Column(
        children: [
          _StatusBanner(controller: controller),
          Expanded(
            child: controller.starredEntries.isEmpty
                ? const _EmptyState(
                    icon: Icons.bookmark_border,
                    title: '暂无收藏文章',
                  )
                : ListView.separated(
                    key: const PageStorageKey('saved-list'),
                    itemCount: controller.starredEntries.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final entry = controller.starredEntries[index];
                      return EntryTile(
                        key: ValueKey('saved-${entry.id}'),
                        entry: entry,
                        feedTitle: controller.feedTitle(entry.feedId),
                        referer: controller.feedUrl(entry.feedId),
                        onTap: () => _openReader(context, controller, entry),
                        onVisible: () =>
                            controller.requestTitleTranslation(entry.id),
                        onReadChanged: (read) =>
                            controller.setRead(entry, read: read),
                        onStarredChanged: (starred) =>
                            controller.setStarred(entry, starred: starred),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

final class _SourcesPage extends StatefulWidget {
  const _SourcesPage({required this.controller, required this.onAddSource});

  final MobileReaderController controller;
  final VoidCallback onAddSource;

  @override
  State<_SourcesPage> createState() => _SourcesPageState();
}

class _SourcesPageState extends State<_SourcesPage> {
  final Set<String> _collapsedGroups = {};

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    return Scaffold(
      appBar: AppBar(
        title: const Text('订阅'),
        actions: [
          IconButton(
            tooltip: '添加订阅',
            onPressed: widget.onAddSource,
            icon: const Icon(Icons.add),
          ),
        ],
      ),
      body: Column(
        children: [
          _StatusBanner(controller: controller),
          Expanded(
            child: controller.feeds.isEmpty
                ? _EmptyState(
                    icon: Icons.rss_feed,
                    title: '还没有订阅源',
                    actionLabel: '添加订阅',
                    onAction: widget.onAddSource,
                  )
                : RefreshIndicator(
                    onRefresh: controller.refreshAll,
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        for (final group in controller.groups)
                          _GroupSection(
                            key: ValueKey('group-${group.name}'),
                            controller: controller,
                            group: group,
                            collapsed: _collapsedGroups.contains(group.name),
                            onToggle: () => setState(() {
                              if (!_collapsedGroups.remove(group.name)) {
                                _collapsedGroups.add(group.name);
                              }
                            }),
                          ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

final class _GroupSection extends StatelessWidget {
  const _GroupSection({
    required this.controller,
    required this.group,
    required this.collapsed,
    required this.onToggle,
    super.key,
  });

  final MobileReaderController controller;
  final GroupSummary group;
  final bool collapsed;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final feedsInGroup = controller.feeds
        .where((feed) => feed.groupName == group.name)
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InkWell(
          onTap: onToggle,
          onLongPress: () => _groupActions(context),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Row(
              children: [
                AnimatedRotation(
                  turns: collapsed ? -0.25 : 0,
                  duration: const Duration(milliseconds: 150),
                  child: const Icon(Icons.expand_more, size: 20),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    groupDisplayName(group.name),
                    style: Theme.of(context).textTheme.titleSmall
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                if (group.unreadEntries > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary
                          .withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '${group.unreadEntries} 未读',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: Theme.of(context).colorScheme.primary,
                      ),
                    ),
                  ),
                const SizedBox(width: 8),
                Text(
                  '${group.feedCount} 源',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ),
        if (!collapsed)
          for (final feed in feedsInGroup)
            _FeedTile(feed: feed, controller: controller),
        const Divider(height: 1),
      ],
    );
  }

  Future<void> _groupActions(BuildContext context) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.edit_outlined),
              title: const Text('重命名分组'),
              onTap: () => Navigator.of(context).pop('rename'),
            ),
            if (group.name != defaultGroupName)
              ListTile(
                leading: const Icon(Icons.folder_off_outlined),
                title: const Text('解散分组（订阅移入未分组）'),
                onTap: () => Navigator.of(context).pop('delete'),
              ),
          ],
        ),
      ),
    );
    if (!context.mounted || action == null) return;

    if (action == 'rename') {
      final nameController = TextEditingController(text: group.name);
      final newName = await showDialog<String>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('重命名分组'),
          content: TextField(
            key: const ValueKey('rename-group-input'),
            controller: nameController,
            autofocus: true,
            onSubmitted: (value) =>
                Navigator.of(dialogContext).pop(value.trim()),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('取消'),
            ),
            FilledButton(
              onPressed: () =>
                  Navigator.of(dialogContext).pop(nameController.text.trim()),
              child: const Text('确定'),
            ),
          ],
        ),
      );
      nameController.dispose();
      if (newName != null && newName.isNotEmpty && newName != group.name) {
        await controller.renameGroup(group.name, newName);
      }
      return;
    }

    if (action == 'delete') {
      await controller.deleteGroup(group.name);
    }
  }
}

final class _FeedTile extends StatelessWidget {
  const _FeedTile({required this.feed, required this.controller});

  final Feed feed;
  final MobileReaderController controller;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      leading: CircleAvatar(
        backgroundColor: Theme.of(context).colorScheme.secondaryContainer,
        foregroundColor: Theme.of(context).colorScheme.onSecondaryContainer,
        child: const Icon(Icons.rss_feed, size: 20),
      ),
      title: Text(feed.title, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text(
        feed.url.toString(),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            tooltip: '刷新订阅',
            onPressed: controller.refreshing
                ? null
                : () => controller.refreshOne(feed),
            icon: const Icon(Icons.refresh, size: 20),
          ),
          PopupMenuButton<String>(
            tooltip: '更多操作',
            onSelected: (action) {
              if (action == 'delete') _confirmDelete(context);
              if (action == 'move') _moveToGroup(context);
            },
            itemBuilder: (_) => const [
              PopupMenuItem(
                value: 'move',
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.drive_file_move_outlined),
                  title: Text('移动到分组'),
                ),
              ),
              PopupMenuItem(
                value: 'delete',
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(Icons.delete_outline),
                  title: Text('删除订阅'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _moveToGroup(BuildContext context) async {
    final selected = await showGroupPicker(
      context,
      existingGroups: {for (final feed in controller.feeds) feed.groupName},
      current: feed.groupName,
    );
    if (selected == null || selected == feed.groupName) return;
    await controller.setFeedGroup(feed, selected);
  }

  Future<void> _confirmDelete(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('删除订阅？'),
        content: Text('“${feed.title}”及其本地文章将被删除。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('删除'),
          ),
        ],
      ),
    );
    if (confirmed == true) await controller.deleteFeed(feed);
  }
}

final class _SettingsPage extends StatefulWidget {
  const _SettingsPage({required this.controller});

  final MobileReaderController controller;

  @override
  State<_SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<_SettingsPage> {
  int _settingsRevision = 0;

  Future<int> _getRefreshInterval() async {
    final sp = await SharedPreferences.getInstance();
    return sp.getInt('refresh_interval_hours') ?? 3;
  }

  Future<void> _setRefreshInterval(int hours) async {
    final sp = await SharedPreferences.getInstance();
    await sp.setInt('refresh_interval_hours', hours);
    initBackgroundRefresh(
      interval: Duration(hours: hours),
      enabled: hours > 0,
    ).catchError((_) {});
    setState(() {});
  }

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onControllerChanged);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onControllerChanged);
    super.dispose();
  }

  void _onControllerChanged() {
    if (mounted) {
      setState(() => _settingsRevision++);
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    // Key forces the FutureBuilder to re-fetch when settings change.
    final settingsKey = ValueKey('settings-ai-$_settingsRevision');
    return Scaffold(
      appBar: AppBar(title: const Text('设置')),
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 8),
        children: [
          const ListTile(
            leading: Icon(Icons.phone_android),
            title: Text('数据模式'),
            subtitle: Text('本地模式'),
            trailing: Icon(Icons.check_circle_outline),
          ),
          const Divider(height: 1, indent: 56),
          ListTile(
            leading: const Icon(Icons.storage_outlined),
            title: const Text('本地数据'),
            subtitle: Text(
              '${controller.feeds.length} 个订阅 · ${controller.entries.length} 篇最近文章',
            ),
          ),
          const Divider(height: 1, indent: 56),
          ListTile(
            leading: const Icon(Icons.lan_outlined),
            title: const Text('网络代理'),
            subtitle: Text(controller.proxyUrl ?? '直连'),
            trailing: const Icon(Icons.edit_outlined),
            onTap: () => showProxySettingsDialog(context, controller),
          ),
          Divider(height: 1, indent: 56),
          FutureBuilder<int>(
            future: _getRefreshInterval(),
            builder: (context, snapshot) {
              final hours = snapshot.data ?? 3;
              return ListTile(
                leading: const Icon(Icons.sync),
                title: const Text('后台刷新'),
                subtitle: Text(hours > 0 ? '每 $hours 小时自动刷新订阅' : '已关闭'),
                trailing: PopupMenuButton<int>(
                  icon: const Icon(Icons.schedule),
                  onSelected: (value) => _setRefreshInterval(value),
                  itemBuilder: (_) => [
                    const PopupMenuItem(value: 0, child: Text('关闭')),
                    for (final h in [1, 2, 3, 6, 12, 24])
                      PopupMenuItem(
                        value: h,
                        child: Text('$h 小时${h == hours ? ' ✓' : ''}'),
                      ),
                  ],
                ),
              );
            },
          ),
          const Divider(height: 1, indent: 56),
          ListTile(
            leading: const Icon(Icons.import_export),
            title: const Text('OPML 导入与导出'),
            subtitle: Text('${controller.feeds.length} 个订阅'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => showOpmlActionsSheet(context, controller),
          ),
          Divider(height: 1, indent: 56),
          ListTile(
            leading: const Icon(Icons.smart_toy_outlined),
            title: const Text('AI 服务'),
            subtitle: FutureBuilder<Map<String, dynamic>>(
              key: settingsKey,
              future: _loadAiStatus(controller),
              builder: (context, snapshot) {
                final data = snapshot.data ?? {};
                final baseUrl = data['baseUrl'] as String? ?? '';
                final modelId = data['modelId'] as String? ?? '';
                final configured = baseUrl.isNotEmpty && modelId.isNotEmpty;
                final modelName = data['modelName'] as String? ?? '';
                return Text(
                  configured
                      ? '已配置 · ${modelName.isNotEmpty ? modelName : modelId}'
                      : '未配置',
                );
              },
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => showAiSettingsSheet(context, controller),
          ),
          const Divider(height: 1, indent: 56),
          const ListTile(
            leading: Icon(Icons.info_outline),
            title: Text('关于 Aurora'),
            subtitle: Text('0.1.0'),
          ),
        ],
      ),
    );
  }
}

final class _StatusBanner extends StatelessWidget {
  const _StatusBanner({required this.controller});

  final MobileReaderController controller;

  @override
  Widget build(BuildContext context) {
    final message = controller.error ?? controller.notice;
    if (message == null) return const SizedBox.shrink();
    final isError = controller.error != null;
    final color = isError
        ? Theme.of(context).colorScheme.error
        : Theme.of(context).colorScheme.secondary;

    return Container(
      color: color.withValues(alpha: 0.08),
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Row(
        children: [
          Icon(
            isError ? Icons.error_outline : Icons.check_circle_outline,
            color: color,
            size: 18,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(message, style: TextStyle(color: color, fontSize: 13)),
          ),
          IconButton(
            tooltip: '关闭',
            visualDensity: VisualDensity.compact,
            onPressed: controller.clearMessages,
            icon: const Icon(Icons.close, size: 18),
          ),
        ],
      ),
    );
  }
}

final class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    this.actionLabel,
    this.actionIcon = Icons.add,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String? actionLabel;
  final IconData actionIcon;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 42,
              color: Theme.of(context).colorScheme.secondary,
            ),
            const SizedBox(height: 16),
            Text(
              title,
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: onAction,
                icon: Icon(actionIcon),
                label: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Loads AI settings status, migrating from the database if needed.
Future<Map<String, dynamic>> _loadAiStatus(
  MobileReaderController controller,
) async {
  final sp = await SharedPreferences.getInstance();
  final raw = sp.getString('ai_settings');
  if (raw != null) {
    try {
      return (jsonDecode(raw) as Map).cast<String, dynamic>();
    } catch (_) {}
  }
  // Try migrating from the database once.
  try {
    final dbConfig = await controller.loadAiConfig();
    final key = await controller.loadSummaryKey();
    if (dbConfig.baseUrl.isNotEmpty && dbConfig.model.isNotEmpty) {
      final prefs = <String, dynamic>{
        'baseUrl': dbConfig.baseUrl,
        'modelId': dbConfig.model,
        'apiKey': key ?? '',
      };
      await sp.setString('ai_settings', jsonEncode(prefs));
      return prefs;
    }
  } catch (_) {}
  return {};
}

void _openReader(
  BuildContext context,
  MobileReaderController controller,
  Entry entry,
) {
  Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => ArticleReaderPage(
        entry: entry,
        feedTitle: controller.feedTitle(entry.feedId),
        controller: controller,
        referer: entry.contentSourceUrl ?? entry.url,
      ),
    ),
  );
}
