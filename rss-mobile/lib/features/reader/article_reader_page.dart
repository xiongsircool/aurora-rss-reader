import 'package:flutter/material.dart';
import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
import 'package:html/parser.dart' as html_parser;
import 'package:url_launcher/url_launcher.dart';

import '../../domain/entities/entry.dart';
import '../reader/mobile_reader_controller.dart';

final class ArticleReaderPage extends StatefulWidget {
  const ArticleReaderPage({
    required this.entry,
    required this.feedTitle,
    required this.controller,
    super.key,
  });

  final Entry entry;
  final String feedTitle;
  final MobileReaderController controller;

  @override
  State<ArticleReaderPage> createState() => _ArticleReaderPageState();
}

class _ArticleReaderPageState extends State<ArticleReaderPage> {
  late Entry _entry;

  @override
  void initState() {
    super.initState();
    _entry = widget.entry;
    if (!_entry.isRead) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _markRead());
    }
  }

  Future<void> _markRead() async {
    await widget.controller.setRead(_entry, read: true);
    if (mounted) {
      setState(() => _entry = _entry.markRead(DateTime.now().toUtc()));
    }
  }

  Future<void> _toggleRead() async {
    final read = !_entry.isRead;
    await widget.controller.setRead(_entry, read: read);
    if (!mounted) return;
    setState(() {
      _entry = read
          ? _entry.markRead(DateTime.now().toUtc())
          : _entry.markUnread();
    });
  }

  Future<void> _toggleStarred() async {
    final starred = !_entry.isStarred;
    await widget.controller.setStarred(_entry, starred: starred);
    if (mounted) setState(() => _entry = _entry.copyWith(isStarred: starred));
  }

  Future<void> _openUrl(Uri? uri) async {
    if (uri == null || (uri.scheme != 'http' && uri.scheme != 'https')) return;
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('无法打开链接')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final html = _entry.content ?? _entry.summary;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.feedTitle,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          IconButton(
            tooltip: _entry.isStarred ? '取消收藏' : '收藏',
            onPressed: _toggleStarred,
            icon: Icon(
              _entry.isStarred ? Icons.star : Icons.star_border,
              color: _entry.isStarred ? const Color(0xFFF4A000) : null,
            ),
          ),
          IconButton(
            tooltip: _entry.isRead ? '标为未读' : '标为已读',
            onPressed: _toggleRead,
            icon: Icon(
              _entry.isRead
                  ? Icons.mark_email_unread_outlined
                  : Icons.check_circle_outline,
            ),
          ),
        ],
      ),
      body: SelectionArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
          children: [
            Text(
              _entry.title,
              style: Theme.of(context).textTheme.headlineSmall
                  ?.copyWith(fontWeight: FontWeight.w700, height: 1.3),
            ),
            const SizedBox(height: 10),
            Text(
              _metadata(_entry, widget.feedTitle),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            if (_entry.imageUrl != null) ...[
              const SizedBox(height: 20),
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: Image.network(
                  _entry.imageUrl.toString(),
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => const SizedBox.shrink(),
                ),
              ),
            ],
            const SizedBox(height: 18),
            if (html == null || html.trim().isEmpty)
              Text(
                '该订阅没有提供正文，请打开原文阅读。',
                style: Theme.of(context).textTheme.bodyLarge,
              )
            else
              HtmlWidget(
                _sanitizeArticleHtml(html),
                textStyle: Theme.of(context).textTheme.bodyLarge
                    ?.copyWith(height: 1.65),
                onTapUrl: (url) async {
                  await _openUrl(Uri.tryParse(url));
                  return true;
                },
              ),
            if (_entry.url != null) ...[
              const SizedBox(height: 24),
              OutlinedButton.icon(
                onPressed: () => _openUrl(_entry.url),
                icon: const Icon(Icons.open_in_new),
                label: const Text('打开原文'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

String _sanitizeArticleHtml(String raw) {
  final fragment = html_parser.parseFragment(raw);
  for (final selector in const [
    'script',
    'style',
    'iframe',
    'object',
    'embed',
    'form',
    'link',
    'meta',
  ]) {
    for (final element in fragment.querySelectorAll(selector)) {
      element.remove();
    }
  }
  return fragment.outerHtml;
}

String _metadata(Entry entry, String feedTitle) {
  final parts = <String>[feedTitle];
  if (entry.author != null && entry.author!.trim().isNotEmpty) {
    parts.add(entry.author!.trim());
  }
  final date = entry.publishedAt;
  if (date != null) {
    final local = date.toLocal();
    parts.add(
      '${local.year}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')}',
    );
  }
  return parts.join(' · ');
}
