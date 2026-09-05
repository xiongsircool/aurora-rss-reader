import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// App-wide constants (kept in one place; update on release).
class AppMeta {
  static const version = '0.1.0';
  static const repoUrl = 'https://github.com/xiongsircool/aurora-rss-reader';
  static const issueUrl = '$repoUrl/issues';
}

/// Branded about page: identity, links, privacy statement, and the
/// open-source license list (LicensePage) required for GPL compliance.
class AboutPage extends StatelessWidget {
  const AboutPage({super.key});

  Future<void> _open(BuildContext context, String url) async {
    final uri = Uri.parse(url);
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && context.mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('无法打开链接')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text('关于 Aurora')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(24, 32, 24, 40),
        children: [
          Center(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: Image.asset(
                'assets/splash/logo.png',
                width: 120,
                height: 120,
              ),
            ),
          ),
          const SizedBox(height: 20),
          Center(
            child: Text(
              'Aurora',
              style: textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(height: 6),
          Center(
            child: Text(
              '本地优先的 RSS 阅读器 · v${AppMeta.version}',
              style: textTheme.bodyMedium?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
            ),
          ),
          const SizedBox(height: 28),
          Text(
            '隐私',
            style: textTheme.titleSmall?.copyWith(color: colorScheme.secondary),
          ),
          const SizedBox(height: 6),
          Text(
            'Aurora 采用本地优先架构：你的订阅、文章、阅读记录与 AI 设置'
            '（包括 API Key）全部只保存在这台设备上的本地数据库中，'
            '没有任何账号系统，也不会上传到任何服务器。'
            '仅在你主动刷新订阅或请求 AI 服务时，才会访问你配置的地址。',
            style: textTheme.bodyMedium?.copyWith(height: 1.6),
          ),
          const SizedBox(height: 24),
          Text(
            '链接',
            style: textTheme.titleSmall?.copyWith(color: colorScheme.secondary),
          ),
          const SizedBox(height: 4),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.code),
            title: const Text('项目主页（GitHub）'),
            subtitle: const Text('开源 · GPL-3.0'),
            trailing: const Icon(Icons.open_in_new, size: 18),
            onTap: () => _open(context, AppMeta.repoUrl),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.bug_report_outlined),
            title: const Text('问题反馈'),
            subtitle: const Text('提交 Issue 帮助改进'),
            trailing: const Icon(Icons.open_in_new, size: 18),
            onTap: () => _open(context, AppMeta.issueUrl),
          ),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.description_outlined),
            title: const Text('开源许可'),
            subtitle: const Text('本软件使用的第三方组件许可'),
            trailing: const Icon(Icons.chevron_right, size: 20),
            onTap: () => showLicensePage(
              context: context,
              applicationName: 'Aurora',
              applicationVersion: AppMeta.version,
              applicationIcon: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.asset('assets/splash/logo.png', width: 56),
              ),
            ),
          ),
          const SizedBox(height: 24),
          Center(
            child: Text(
              '© 2026 Aurora · 以 GPLv3 协议开源',
              style: textTheme.bodySmall?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
