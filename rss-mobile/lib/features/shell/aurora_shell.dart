import '../../shared/clear_glass_surface.dart';

import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:file_picker/file_picker.dart';
import 'package:share_plus/share_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../platform/background/background_refresh.dart';

import '../../data/repositories/local_content_repository.dart'
    show GroupSummary;
import '../../domain/entities/entry.dart';
import '../../domain/entities/feed.dart';
import '../inbox/entry_tile.dart';
import '../inbox/refresh_status_banner.dart';
import '../inbox/inbox_filter_sheet.dart';
import '../reader/article_reader_page.dart';
import '../reader/mobile_reader_controller.dart';
import '../search/search_page.dart';
import '../settings/ai_settings_sheet.dart';
import '../settings/about_page.dart';
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
  Entry? _selectedEntry;

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
        return LayoutBuilder(
          builder: (context, constraints) {
            final largeText = MediaQuery.textScalerOf(context).scale(16) > 22;
            final rail = constraints.maxWidth >= 700;
            final split =
                constraints.maxWidth >= (largeText ? 1250 : 1000) &&
                _selectedIndex < 2;
            final inset = MediaQuery.viewPaddingOf(context).bottom;
            final listWidth = split
                ? (largeText ? 430.0 : 380.0)
                : constraints.maxWidth - (rail ? 88 : 0);
            final pages = MediaQuery(
              data: MediaQuery.of(context)
                  .copyWith(size: Size(listWidth, constraints.maxHeight)),
              child: IndexedStack(
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
            );
            return _ReaderLayoutScope(
              bottomClearance: rail ? 12 : 78,
              openEntry: split
                  ? (entry) => setState(() => _selectedEntry = entry)
                  : null,
              child: Scaffold(
                body: rail
                    ? Row(
                        children: [
                          SafeArea(
                            child: NavigationRail(
                              minWidth: 88,
                              selectedIndex: _selectedIndex,
                              labelType: NavigationRailLabelType.all,
                              onDestinationSelected: _select,
                              destinations: [
                                for (final d in _destinations)
                                  NavigationRailDestination(
                                    icon: d.icon,
                                    selectedIcon: d.selectedIcon,
                                    label: Text(d.label),
                                  ),
                              ],
                            ),
                          ),
                          const VerticalDivider(width: 1),
                          if (split) ...[
                            SizedBox(width: listWidth, child: pages),
                            const VerticalDivider(width: 1),
                            Expanded(
                              child: _selectedEntry == null
                                  ? const Center(child: Text('选择一篇文章开始阅读'))
                                  : LayoutBuilder(
                                      builder: (context, readerConstraints) =>
                                          MediaQuery(
                                            data: MediaQuery.of(context)
                                                .copyWith(
                                                  size: Size(
                                                    readerConstraints.maxWidth,
                                                    readerConstraints.maxHeight,
                                                  ),
                                                ),
                                            child: ArticleReaderPage(
                                              key: ValueKey(_selectedEntry!.id),
                                              entry: _selectedEntry!,
                                              feedTitle: widget.controller
                                                  .feedTitle(
                                                    _selectedEntry!.feedId,
                                                  ),
                                              referer: widget.controller
                                                  .feedUrl(
                                                    _selectedEntry!.feedId,
                                                  ),
                                              controller: widget.controller,
                                              embedded: true,
                                            ),
                                          ),
                                    ),
                            ),
                          ] else
                            Expanded(child: pages),
                        ],
                      )
                    : Stack(
                        children: [
                          Positioned.fill(child: pages),
                          if (MediaQuery.viewInsetsOf(context).bottom == 0)
                            Positioned(
                              left: 20,
                              right: 20,
                              bottom: inset + 4,
                              child: _FloatingCapsuleBar(
                                selectedIndex: _selectedIndex,
                                destinations: _destinations,
                                onDestinationSelected: _select,
                              ),
                            ),
                        ],
                      ),
              ),
            );
          },
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
                Text(greeting, maxLines: 1, overflow: TextOverflow.ellipsis),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
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
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            RefreshStatusBanner(controller: controller),
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

    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (notification.depth == 0 &&
            notification is ScrollUpdateNotification &&
            controller.error?.contains('加载更多') != true &&
            notification.metrics.extentAfter < 600 &&
            controller.entries.length < 500) {
          controller.loadMore();
        }
        return false;
      },
      child: RefreshIndicator(
        onRefresh: controller.refreshAll,
        child: ListView.separated(
          key: const PageStorageKey('inbox-list'),
          padding: EdgeInsets.only(
            bottom:
                MediaQuery.viewPaddingOf(context).bottom +
                _ReaderLayoutScope.clearance(context),
          ),
          physics: const AlwaysScrollableScrollPhysics(),
          itemCount: controller.entries.length + (controller.hasMore ? 1 : 0),
          separatorBuilder: (_, _) => Divider(
            height: 1,
            color: Theme.of(context).colorScheme.outlineVariant
                .withValues(alpha: 0.35),
          ),
          itemBuilder: (context, index) {
            if (index == controller.entries.length) {
              if (controller.loadingMore) {
                return const Padding(
                  padding: EdgeInsets.all(20),
                  child: Center(
                    child: SizedBox.square(
                      dimension: 22,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                );
              }
              final failed = controller.error?.contains('加载更多') ?? false;
              if (failed) {
                return Padding(
                  padding: const EdgeInsets.all(16),
                  child: Center(
                    child: ActionChip(
                      avatar: const Icon(Icons.refresh, size: 16),
                      label: const Text('加载失败，点击重试'),
                      onPressed: controller.loadMore,
                    ),
                  ),
                );
              }
              return Padding(
                padding: const EdgeInsets.all(16),
                child: Center(
                  child: controller.entries.length >= 500
                      ? TextButton.icon(
                          onPressed: controller.loadMore,
                          icon: const Icon(Icons.expand_more),
                          label: Text(
                            '已加载 ${controller.entries.length} 篇，继续加载',
                          ),
                        )
                      : const SizedBox(height: 4),
                ),
              );
            }
            final entry = controller.entries[index];
            return EntryTile(
              key: ValueKey(entry.id),
              entry: entry,
              feedTitle: controller.feedTitle(entry.feedId),
              feedIconUrl: controller.feedIconUrl(entry.feedId),
              referer: controller.feedUrl(entry.feedId),
              onTap: () => _openReader(context, controller, entry),
              onVisible: () => controller.requestTitleTranslation(entry.id),
              onReadChanged: (read) => controller.setRead(entry, read: read),
              onStarredChanged: (starred) =>
                  controller.setStarred(entry, starred: starred),
            );
          },
        ),
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
          RefreshStatusBanner(controller: controller),
          Expanded(
            child: controller.starredEntries.isEmpty
                ? const _EmptyState(
                    icon: Icons.bookmark_border,
                    title: '暂无收藏文章',
                  )
                : ListView.separated(
                    key: const PageStorageKey('saved-list'),
                    padding: EdgeInsets.only(
                      bottom:
                          MediaQuery.viewPaddingOf(context).bottom +
                          _ReaderLayoutScope.clearance(context),
                    ),
                    itemCount: controller.starredEntries.length,
                    separatorBuilder: (_, _) => Divider(
                      height: 1,
                      color: Theme.of(context).colorScheme.outlineVariant
                          .withValues(alpha: 0.35),
                    ),
                    itemBuilder: (context, index) {
                      final entry = controller.starredEntries[index];
                      return EntryTile(
                        key: ValueKey('saved-${entry.id}'),
                        entry: entry,
                        feedTitle: controller.feedTitle(entry.feedId),
                        feedIconUrl: controller.feedIconUrl(entry.feedId),
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
          RefreshStatusBanner(controller: controller),
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
                      padding: EdgeInsets.only(
                        bottom:
                            MediaQuery.viewPaddingOf(context).bottom +
                            _ReaderLayoutScope.clearance(context),
                      ),
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
        Divider(
          height: 1,
          color: Theme.of(context).colorScheme.outlineVariant
              .withValues(alpha: 0.35),
        ),
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

  void _showDetails(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          24,
          0,
          24,
          24 + MediaQuery.paddingOf(context).bottom,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(feed.title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            SelectableText(feed.url.toString()),
            const SizedBox(height: 12),
            Text('${feed.unreadCount} 篇未读'),
            if (feed.lastCheckedAt != null)
              Text(
                '上次检查：${MaterialLocalizations.of(context).formatShortDate(feed.lastCheckedAt!.toLocal())} '
                '${MaterialLocalizations.of(context).formatTimeOfDay(TimeOfDay.fromDateTime(feed.lastCheckedAt!.toLocal()))}',
              ),
            if (feed.lastError != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  '上次刷新未完成，可以检查网络后重试。',
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            const SizedBox(height: 16),
            FilledButton.tonalIcon(
              onPressed: controller.refreshing
                  ? null
                  : () {
                      Navigator.pop(context);
                      controller.refreshOne(feed);
                    },
              icon: const Icon(Icons.refresh),
              label: const Text('刷新这个订阅'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final iconUrl = feed.iconUrl?.toString();
    final leading = iconUrl != null && iconUrl.isNotEmpty
        ? ClipOval(
            child: CachedNetworkImage(
              imageUrl: iconUrl,
              width: 40,
              height: 40,
              fit: BoxFit.cover,
              placeholder: (_, _) => Container(
                color: Theme.of(context).colorScheme.secondaryContainer,
                alignment: Alignment.center,
                child: const Icon(Icons.rss_feed, size: 20),
              ),
              errorWidget: (_, _, _) => Container(
                color: Theme.of(context).colorScheme.secondaryContainer,
                alignment: Alignment.center,
                child: const Icon(Icons.rss_feed, size: 20),
              ),
            ),
          )
        : CircleAvatar(
            backgroundColor: Theme.of(context).colorScheme.secondaryContainer,
            foregroundColor: Theme.of(context).colorScheme.onSecondaryContainer,
            child: const Icon(Icons.rss_feed, size: 20),
          );
    return ListTile(
      contentPadding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      leading: leading,
      title: Text(feed.title, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text(
        '${feed.unreadCount} 篇未读 · ${feed.lastError != null
            ? '上次刷新失败'
            : feed.lastCheckedAt == null
            ? '尚未刷新'
            : '已刷新'}',
        style: feed.lastError == null
            ? null
            : TextStyle(color: Theme.of(context).colorScheme.error),
      ),
      onTap: () => _showDetails(context),
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

  Future<void> _exportFullBackup(BuildContext context) async {
    if (widget.controller.refreshing) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('刷新中无法备份，请稍后再试')));
      return;
    }
    final messenger = ScaffoldMessenger.of(context);
    final renderBox = context.findRenderObject() as RenderBox?;
    try {
      final bytes = await widget.controller.exportFullBackup();
      final box = renderBox;
      final now = DateTime.now();
      final name =
          'aurora-backup-${now.year}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}-${now.hour.toString().padLeft(2, '0')}${now.minute.toString().padLeft(2, '0')}.aurora-backup';
      await SharePlus.instance.share(
        ShareParams(
          files: [
            XFile.fromData(
              bytes,
              mimeType: 'application/octet-stream',
              name: name,
            ),
          ],
          fileNameOverrides: [name],
          subject: 'Aurora 数据备份',
          sharePositionOrigin: box == null
              ? null
              : box.localToGlobal(Offset.zero) & box.size,
        ),
      );
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text('备份失败：$error')));
    }
  }

  Future<void> _importFullBackup(BuildContext context) async {
    try {
      final files = await FilePicker.pickFiles(type: FileType.any);
      if (files.isEmpty || !context.mounted) return;
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('替换当前数据？'),
          content: const Text('恢复会覆盖当前订阅、文章和阅读记录。请先导出当前备份；API Key 不会随备份迁移。'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('取消'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('验证并准备恢复'),
            ),
          ],
        ),
      );
      if (confirmed != true || !context.mounted) return;
      final bytes = await files.single.readAsBytes();
      await widget.controller.importFullBackup(bytes);
      if (!context.mounted) return;
      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('备份已验证'),
          content: const Text('恢复已准备就绪。请关闭 Aurora 并重新打开；重启前的新增操作会被备份覆盖。'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('知道了'),
            ),
          ],
        ),
      );
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('备份读取或验证失败，请确认文件完整且与此版本兼容')),
        );
      }
    }
  }

  Future<void> _openBatteryOptimizationSettings() async {
    const channel = MethodChannel('aurora.mobile/system');
    try {
      await channel.invokeMethod<bool>('openBatteryOptimizationSettings');
    } on PlatformException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('无法打开系统设置：${e.message ?? e.code}')),
        );
      }
    }
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
    return Scaffold(
      appBar: AppBar(title: const Text('设置')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 760),
          child: ListView(
            padding: EdgeInsets.fromLTRB(
              16,
              8,
              16,
              MediaQuery.viewPaddingOf(context).bottom +
                  _ReaderLayoutScope.clearance(context),
            ),
            children: [
              _SettingsSection(
                title: '阅读与外观',
                children: [
                  const ListTile(
                    leading: Icon(Icons.auto_stories_outlined),
                    title: Text('阅读排版'),
                    subtitle: Text('在文章右上角调整字号、行距和字体，设置会自动保存。'),
                  ),
                  const ListTile(
                    leading: Icon(Icons.dark_mode_outlined),
                    title: Text('深浅主题'),
                    subtitle: Text('跟随系统外观'),
                  ),
                ],
              ),
              _SettingsSection(
                title: '订阅与网络',
                children: [
                  ListTile(
                    leading: const Icon(Icons.lan_outlined),
                    title: const Text('网络代理'),
                    subtitle: Text(controller.proxyUrl ?? '直连'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => showProxySettingsDialog(context, controller),
                  ),
                  FutureBuilder<int>(
                    future: _getRefreshInterval(),
                    builder: (context, snapshot) {
                      final hours = snapshot.data ?? 3;
                      return ListTile(
                        leading: const Icon(Icons.sync),
                        title: const Text('后台刷新'),
                        subtitle: Text(
                          hours > 0 ? '约每 $hours 小时，执行时间由系统安排' : '已关闭',
                        ),
                        trailing: PopupMenuButton<int>(
                          tooltip: '刷新间隔',
                          icon: const Icon(Icons.schedule),
                          onSelected: _setRefreshInterval,
                          itemBuilder: (_) => [
                            const PopupMenuItem(value: 0, child: Text('关闭')),
                            for (final h in [1, 2, 3, 6, 12, 24])
                              PopupMenuItem(value: h, child: Text('$h 小时')),
                          ],
                        ),
                      );
                    },
                  ),
                  if (Theme.of(context).platform == TargetPlatform.android)
                    ListTile(
                      leading: const Icon(Icons.battery_saver),
                      title: const Text('电池优化豁免'),
                      subtitle: const Text('前往系统设置调整后台限制'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: _openBatteryOptimizationSettings,
                    ),
                  ListTile(
                    leading: const Icon(Icons.import_export),
                    title: const Text('OPML 导入与导出'),
                    subtitle: const Text('迁移订阅列表，不包含文章、收藏和阅读记录'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => showOpmlActionsSheet(context, controller),
                  ),
                ],
              ),
              _SettingsSection(
                title: 'AI 服务',
                children: [
                  ListTile(
                    leading: const Icon(Icons.auto_awesome_outlined),
                    title: const Text('AI 服务'),
                    subtitle: FutureBuilder<Map<String, dynamic>>(
                      key: ValueKey(_settingsRevision),
                      future: _loadAiStatus(controller),
                      builder: (context, snapshot) {
                        final data = snapshot.data ?? {};
                        final model =
                            data['modelName'] ?? data['modelId'] ?? '';
                        return Text(
                          model.toString().isEmpty
                              ? '配置自己的服务地址、模型和 Key'
                              : '已配置 · $model',
                        );
                      },
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () async {
                      await showAiSettingsSheet(context, controller);
                      if (mounted) setState(() => _settingsRevision++);
                    },
                  ),
                ],
              ),
              _SettingsSection(
                title: '数据与备份',
                children: [
                  ListTile(
                    leading: const Icon(Icons.storage_outlined),
                    title: const Text('本地数据'),
                    subtitle: FutureBuilder<({int total, int read, int starred})>(
                      future: controller.repository.entryStats(),
                      builder: (context, snapshot) {
                        final stats = snapshot.data;
                        if (snapshot.hasError) return const Text('暂时无法读取统计');
                        return Text(
                          stats == null
                              ? '正在读取统计…'
                              : '${controller.feeds.length} 个订阅 · ${stats.total} 篇文章\n已读 ${stats.read} · 收藏 ${stats.starred}',
                        );
                      },
                    ),
                  ),
                  ListTile(
                    leading: const Icon(Icons.backup_outlined),
                    title: const Text('备份全部数据'),
                    subtitle: const Text('导出设备中的数据库，API Key 需单独保管'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => _exportFullBackup(context),
                  ),
                  ListTile(
                    leading: const Icon(Icons.restore),
                    title: const Text('恢复备份'),
                    subtitle: const Text('恢复将替换当前数据，请先保留当前备份'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => _importFullBackup(context),
                  ),
                ],
              ),
              _SettingsSection(
                title: '关于',
                children: [
                  ListTile(
                    leading: const Icon(Icons.info_outline),
                    title: const Text('关于 Aurora'),
                    subtitle: const Text('${AppMeta.version} · 本地优先 · GPL-3.0'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const AboutPage(),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SettingsSection extends StatelessWidget {
  const _SettingsSection({required this.title, required this.children});
  final String title;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 20),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
          child: Text(
            title,
            style: Theme.of(context).textTheme.labelLarge
                ?.copyWith(color: Theme.of(context).colorScheme.secondary),
          ),
        ),
        Material(
          color: Theme.of(context).colorScheme.surfaceContainerLow,
          borderRadius: BorderRadius.circular(16),
          clipBehavior: Clip.antiAlias,
          child: Column(children: children),
        ),
      ],
    ),
  );
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
  final openInPane = context
      .dependOnInheritedWidgetOfExactType<_ReaderLayoutScope>()
      ?.openEntry;
  if (openInPane != null) {
    openInPane(entry);
    return;
  }
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

/// Floating capsule navigation bar (iOS 18 style): a rounded frosted
/// pill hovering above the content with margins on all sides.
final class _FloatingCapsuleBar extends StatelessWidget {
  const _FloatingCapsuleBar({
    required this.selectedIndex,
    required this.destinations,
    required this.onDestinationSelected,
  });

  final int selectedIndex;
  final List<NavigationDestination> destinations;
  final ValueChanged<int> onDestinationSelected;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ClearGlassSurface(
      child: Material(
        type: MaterialType.transparency,
        child: SizedBox(
          height: (48 + MediaQuery.textScalerOf(context).scale(11)).clamp(
            62.0,
            120.0,
          ),
          child: Row(
            children: [
              for (var i = 0; i < destinations.length; i++)
                Expanded(
                  child: InkWell(
                    borderRadius: BorderRadius.circular(28),
                    onTap: () => onDestinationSelected(i),
                    child: TweenAnimationBuilder<double>(
                      tween: Tween(end: i == selectedIndex ? 1.06 : 1.0),
                      curve: Curves.easeOutBack,
                      duration: MediaQuery.disableAnimationsOf(context)
                          ? Duration.zero
                          : const Duration(milliseconds: 220),
                      builder: (context, scale, child) =>
                          Transform.scale(scale: scale, child: child),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          IconTheme(
                            data: IconThemeData(
                              size: 24,
                              color: i == selectedIndex
                                  ? scheme.primary
                                  : scheme.onSurfaceVariant.withValues(
                                      alpha: 0.8,
                                    ),
                            ),
                            child: (i == selectedIndex
                                ? destinations[i].selectedIcon ??
                                      destinations[i].icon
                                : destinations[i].icon),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            destinations[i].label,
                            semanticsLabel: i == selectedIndex
                                ? '${destinations[i].label}，已选择'
                                : destinations[i].label,
                            style: TextStyle(
                              fontSize: 11,
                              height: 1,
                              fontWeight: i == selectedIndex
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                              color: i == selectedIndex
                                  ? scheme.primary
                                  : scheme.onSurfaceVariant.withValues(
                                      alpha: 0.8,
                                    ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ReaderLayoutScope extends InheritedWidget {
  const _ReaderLayoutScope({
    required this.bottomClearance,
    required this.openEntry,
    required super.child,
  });
  final double bottomClearance;
  final ValueChanged<Entry>? openEntry;
  static double clearance(BuildContext context) =>
      context
          .dependOnInheritedWidgetOfExactType<_ReaderLayoutScope>()
          ?.bottomClearance ??
      78;
  @override
  bool updateShouldNotify(_ReaderLayoutScope old) =>
      bottomClearance != old.bottomClearance || openEntry != old.openEntry;
}
