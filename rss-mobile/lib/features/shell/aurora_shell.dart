import 'package:flutter/material.dart';

final class AuroraShell extends StatefulWidget {
  const AuroraShell({super.key});

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
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _selectedIndex,
        children: [
          _InboxPage(onAddSource: () => _select(2)),
          const _SavedPage(),
          const _SourcesPage(),
          const _SettingsPage(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        destinations: _destinations,
        onDestinationSelected: _select,
      ),
    );
  }

  void _select(int index) {
    setState(() => _selectedIndex = index);
  }
}

final class _InboxPage extends StatelessWidget {
  const _InboxPage({required this.onAddSource});

  final VoidCallback onAddSource;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Aurora'),
        actions: [
          IconButton(
            tooltip: '刷新',
            onPressed: () {},
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: SegmentedButton<int>(
                segments: const [
                  ButtonSegment(value: 0, label: Text('全部')),
                  ButtonSegment(value: 1, label: Text('未读')),
                ],
                selected: const {0},
              ),
            ),
            Expanded(
              child: _EmptyState(
                icon: Icons.inbox_outlined,
                title: '收件箱为空',
                actionLabel: '添加订阅',
                onAction: onAddSource,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

final class _SavedPage extends StatelessWidget {
  const _SavedPage();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('收藏')),
      body: const _EmptyState(icon: Icons.bookmark_border, title: '暂无收藏文章'),
    );
  }
}

final class _SourcesPage extends StatelessWidget {
  const _SourcesPage();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('订阅'),
        actions: [
          IconButton(
            tooltip: '添加订阅',
            onPressed: () {},
            icon: const Icon(Icons.add),
          ),
        ],
      ),
      body: const _EmptyState(icon: Icons.rss_feed, title: '还没有订阅源'),
    );
  }
}

final class _SettingsPage extends StatelessWidget {
  const _SettingsPage();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('设置')),
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 8),
        children: const [
          ListTile(
            leading: Icon(Icons.phone_android),
            title: Text('数据模式'),
            subtitle: Text('本地模式'),
            trailing: Icon(Icons.chevron_right),
          ),
          Divider(height: 1, indent: 56),
          ListTile(
            leading: Icon(Icons.smart_toy_outlined),
            title: Text('AI 服务'),
            subtitle: Text('未配置'),
            trailing: Icon(Icons.chevron_right),
          ),
          Divider(height: 1, indent: 56),
          ListTile(
            leading: Icon(Icons.info_outline),
            title: Text('关于 Aurora'),
            subtitle: Text('0.1.0'),
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
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String? actionLabel;
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
                icon: const Icon(Icons.add),
                label: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
