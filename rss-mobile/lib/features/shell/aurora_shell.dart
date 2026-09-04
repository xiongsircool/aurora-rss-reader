import 'package:flutter/material.dart';

import '../../domain/entities/entry.dart';
import '../../domain/entities/feed.dart';
import '../inbox/entry_tile.dart';
import '../reader/article_reader_page.dart';
import '../reader/mobile_reader_controller.dart';
import '../search/search_page.dart';
import '../settings/opml_actions_sheet.dart';
import '../settings/proxy_settings_dialog.dart';
import '../sources/add_feed_sheet.dart';

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
        title: const Text('Aurora'),
        actions: [
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
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _StatusBanner(controller: controller),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
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

final class _SourcesPage extends StatelessWidget {
  const _SourcesPage({required this.controller, required this.onAddSource});

  final MobileReaderController controller;
  final VoidCallback onAddSource;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('订阅'),
        actions: [
          IconButton(
            tooltip: '添加订阅',
            onPressed: onAddSource,
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
                    onAction: onAddSource,
                  )
                : RefreshIndicator(
                    onRefresh: controller.refreshAll,
                    child: ListView.separated(
                      physics: const AlwaysScrollableScrollPhysics(),
                      itemCount: controller.feeds.length,
                      separatorBuilder: (_, _) => const Divider(height: 1),
                      itemBuilder: (context, index) => _FeedTile(
                        feed: controller.feeds[index],
                        controller: controller,
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
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
            },
            itemBuilder: (_) => const [
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

final class _SettingsPage extends StatelessWidget {
  const _SettingsPage({required this.controller});

  final MobileReaderController controller;

  @override
  Widget build(BuildContext context) {
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
          const Divider(height: 1, indent: 56),
          ListTile(
            leading: const Icon(Icons.import_export),
            title: const Text('OPML 导入与导出'),
            subtitle: Text('${controller.feeds.length} 个订阅'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => showOpmlActionsSheet(context, controller),
          ),
          const Divider(height: 1, indent: 56),
          const ListTile(
            leading: Icon(Icons.smart_toy_outlined),
            title: Text('AI 服务'),
            subtitle: Text('未配置'),
            trailing: Icon(Icons.chevron_right),
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
