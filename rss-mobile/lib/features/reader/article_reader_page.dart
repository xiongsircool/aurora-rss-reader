import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
import 'package:html/parser.dart' as html_parser;
import 'package:url_launcher/url_launcher.dart';

import '../../data/repositories/reader_prefs_repository.dart';
import '../../domain/entities/entry.dart';
import '../../shared/image_viewer_page.dart';
import '../reader/mobile_reader_controller.dart';

final class ArticleReaderPage extends StatefulWidget {
  const ArticleReaderPage({
    required this.entry,
    required this.feedTitle,
    required this.controller,
    this.referer,
    super.key,
  });

  final Entry entry;
  final String feedTitle;
  final MobileReaderController controller;

  /// Page URL used as the Referer for embedded images; many site CDNs
  /// reject image requests without it.
  final Uri? referer;

  @override
  State<ArticleReaderPage> createState() => _ArticleReaderPageState();
}

class _ArticleReaderPageState extends State<ArticleReaderPage> {
  late Entry _entry;
  bool _extracting = false;
  bool _showOriginal = false;
  String _summaryText = '';
  bool _summaryGenerating = false;
  String? _summaryError;
  StreamSubscription<String>? _summarySub;
  double _fontSize = 16.0;
  double _lineHeight = 1.65;
  late final ReaderPrefsRepository _prefs;

  @override
  void initState() {
    super.initState();
    _entry = widget.entry;
    _prefs = ReaderPrefsRepository(widget.controller.repository.database);
    _prefs.loadFontSize().then((v) {
      if (mounted) setState(() => _fontSize = v);
    });
    _prefs.loadLineHeight().then((v) {
      if (mounted) setState(() => _lineHeight = v);
    });
    if (!_entry.isRead) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _markRead());
    }
    _loadCachedSummary();
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

  Future<void> _extractFullText() async {
    if (_extracting) return;
    setState(() => _extracting = true);
    final updated = await widget.controller.extractFullText(_entry);
    if (!mounted) return;
    setState(() {
      _extracting = false;
      if (updated != null) _entry = updated;
    });
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
  void dispose() {
    _summarySub?.cancel();
    _translateSub?.cancel();
    super.dispose();
  }

  void _startArticleTranslation() {
    if (_translatingArticle) return;
    // Translate what the user is currently viewing, not always the
    // extracted version.
    final content = _showOriginal
        ? (_entry.content ?? _entry.summary)
        : (_entry.readabilityContent ?? _entry.content ?? _entry.summary);
    if (content == null || content.trim().length < 30) return;

    setState(() {
      _translatingArticle = true;
      _translatedArticle = '';
      _translationProgress = 0.0;
    });

    _translateSub = widget.controller
        .translateArticle(entryId: _entry.id, contentHtml: content)
        .listen(
          (update) {
            if (mounted) {
              setState(() {
                _translationProgress = update.progress;
                _translatedArticle = update.text;
              });
            }
          },
          onError: (error) {
            if (mounted) {
              setState(() => _translatingArticle = false);
            }
          },
          onDone: () {
            if (mounted) setState(() => _translatingArticle = false);
          },
        );
  }

  String? _translatedTitle;
  bool _translatingTitle = false;
  String _translatedArticle = '';
  bool _translatingArticle = false;
  double _translationProgress = 0.0;
  StreamSubscription<({double progress, String text})>? _translateSub;

  Future<void> _translateTitle() async {
    if (_translatingTitle) return;
    setState(() => _translatingTitle = true);
    try {
      final result = await widget.controller.translateTitle(
        entryId: _entry.id,
        title: _entry.title,
      );
      if (mounted && result != null) {
        setState(() => _translatedTitle = result);
      }
    } finally {
      if (mounted) setState(() => _translatingTitle = false);
    }
  }

  Future<void> _loadCachedSummary() async {
    final cached = await widget.controller.repository.loadSummary(
      entryId: _entry.id,
      language: 'zh',
    );
    if (cached != null && cached.isNotEmpty && mounted) {
      setState(() => _summaryText = cached);
    }
  }

  void _startSummary() {
    if (_summaryGenerating) return;
    final content =
        _entry.readabilityContent ?? _entry.content ?? _entry.summary;
    if (content == null || content.trim().length < 30) return;

    setState(() {
      _summaryGenerating = true;
      _summaryText = '';
      _summaryError = null;
    });

    _summarySub = widget.controller
        .generateSummary(entryId: _entry.id, contentHtml: content)
        .listen(
          (text) {
            if (mounted) setState(() => _summaryText = text);
          },
          onError: (error) {
            if (mounted) {
              setState(() {
                _summaryGenerating = false;
                _summaryError = error.toString();
              });
            }
          },
          onDone: () {
            if (mounted) setState(() => _summaryGenerating = false);
          },
        );
  }

  @override
  Widget build(BuildContext context) {
    final hasExtracted = _entry.readabilityContent != null;
    final hasOriginal = _entry.content != null || _entry.summary != null;
    final html = _showOriginal
        ? (_entry.content ?? _entry.summary)
        : (_entry.readabilityContent ?? _entry.content ?? _entry.summary);
    final referer = widget.referer;
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
          PopupMenuButton<double>(
            tooltip: '字号',
            icon: const Icon(Icons.format_size),
            onSelected: (size) {
              setState(() => _fontSize = size);
              _prefs.saveFontSize(size);
            },
            itemBuilder: (_) => [
              for (final s in [14.0, 15.0, 16.0, 17.0, 18.0, 20.0, 22.0])
                PopupMenuItem(
                  value: s,
                  child: Row(
                    children: [
                      if (s == _fontSize)
                        const Icon(Icons.check, size: 18)
                      else
                        const SizedBox(width: 18),
                      const SizedBox(width: 8),
                      Text(s == _fontSize ? '${s.toInt()} ✓' : '${s.toInt()}'),
                    ],
                  ),
                ),
            ],
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
            if (_translatedTitle != null) ...[
              const SizedBox(height: 4),
              Text(
                _translatedTitle!,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.secondary,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ] else if (_translatingTitle) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  const SizedBox.square(
                    dimension: 14,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '翻译标题中…',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 6),
            Row(
              children: [
                Text(
                  _metadata(_entry, widget.feedTitle),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                const Spacer(),
                if (_translatedTitle == null && !_translatingTitle)
                  GestureDetector(
                    onTap: _translateTitle,
                    child: Row(
                      children: [
                        Icon(
                          Icons.translate,
                          size: 14,
                          color: Theme.of(context).colorScheme.secondary,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '翻译标题',
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: Theme.of(context).colorScheme.secondary,
                              ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
            if (_entry.imageUrl != null) ...[
              const SizedBox(height: 20),
              GestureDetector(
                onTap: () => ImageViewerPage.show(
                  context,
                  url: _entry.imageUrl!,
                  referer: referer,
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: CachedNetworkImage(
                    imageUrl: _entry.imageUrl.toString(),
                    httpHeaders: referer == null
                        ? null
                        : {'Referer': referer.toString()},
                    fit: BoxFit.cover,
                    errorWidget: (_, _, _) => const SizedBox.shrink(),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 18),
            // AI 摘要面板
            if (_summaryText.isNotEmpty ||
                _summaryGenerating ||
                _summaryError != null)
              Container(
                key: const ValueKey('ai-summary-panel'),
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.secondaryContainer
                      .withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: Theme.of(context).colorScheme.secondary
                        .withValues(alpha: 0.2),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.auto_awesome,
                          size: 16,
                          color: Theme.of(context).colorScheme.secondary,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'AI 摘要',
                          style: Theme.of(context).textTheme.labelMedium
                              ?.copyWith(
                                color: Theme.of(context).colorScheme.secondary,
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                        const Spacer(),
                        if (_summaryGenerating)
                          const SizedBox.square(
                            dimension: 14,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        else if (_summaryText.isNotEmpty)
                          IconButton(
                            visualDensity: VisualDensity.compact,
                            tooltip: '重新生成',
                            onPressed: _startSummary,
                            icon: const Icon(Icons.refresh, size: 16),
                          ),
                      ],
                    ),
                    if (_summaryText.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        _summaryText,
                        style: Theme.of(context).textTheme.bodyMedium
                            ?.copyWith(height: 1.6),
                      ),
                    ],
                    if (_summaryError != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        _summaryError!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ],
                ),
              )
            else
            // AI 摘要按钮
            if (!_summaryGenerating)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        key: const ValueKey('generate-ai-summary'),
                        onPressed: _startSummary,
                        icon: const Icon(Icons.auto_awesome, size: 18),
                        label: const Text('AI 摘要'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Theme.of(context)
                              .colorScheme
                              .secondary,
                          side: BorderSide(
                            color: Theme.of(context).colorScheme.secondary
                                .withValues(alpha: 0.3),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: OutlinedButton.icon(
                        key: const ValueKey('translate-article'),
                        onPressed: _translatingArticle
                            ? null
                            : _startArticleTranslation,
                        icon: _translatingArticle
                            ? SizedBox.square(
                                dimension: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  value: _translationProgress > 0
                                      ? _translationProgress
                                      : null,
                                ),
                              )
                            : const Icon(Icons.translate, size: 18),
                        label: Text(
                          _translatingArticle
                              ? '${(_translationProgress * 100).toInt()}%'
                              : '翻译全文',
                        ),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Theme.of(context)
                              .colorScheme
                              .primary,
                          side: BorderSide(
                            color: Theme.of(context).colorScheme.primary
                                .withValues(alpha: 0.3),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            if (hasExtracted && hasOriginal)
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: SegmentedButton<bool>(
                  segments: const [
                    ButtonSegment(
                      value: true,
                      label: Text('订阅原文'),
                      icon: Icon(Icons.rss_feed, size: 16),
                    ),
                    ButtonSegment(
                      value: false,
                      label: Text('网页全文'),
                      icon: Icon(Icons.article_outlined, size: 16),
                    ),
                  ],
                  selected: {_showOriginal},
                  showSelectedIcon: false,
                  style: ButtonStyle(
                    visualDensity: VisualDensity.compact,
                    textStyle: WidgetStatePropertyAll(
                      Theme.of(context).textTheme.labelMedium,
                    ),
                  ),
                  onSelectionChanged: (selection) {
                    setState(() => _showOriginal = selection.single);
                  },
                ),
              ),
            if (!hasExtracted && _entry.url != null) ...[
              FilledButton.tonalIcon(
                key: const ValueKey('extract-full-text'),
                onPressed: _extracting ? null : _extractFullText,
                icon: _extracting
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.article_outlined),
                label: Text(_extracting ? '正在提取' : '提取网页全文'),
              ),
              if (_entry.contentExtractionStatus ==
                  ContentExtractionStatus.failed) ...[
                const SizedBox(height: 8),
                Text(
                  '提取失败，已保留订阅正文。',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.error,
                    fontSize: 13,
                  ),
                ),
              ],
              const SizedBox(height: 16),
            ] else if (hasExtracted) ...[
              Row(
                children: [
                  Icon(
                    Icons.check_circle_outline,
                    size: 16,
                    color: Theme.of(context).colorScheme.secondary,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    _showOriginal ? '显示订阅原文' : '网页全文已缓存',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: Theme.of(context).colorScheme.secondary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
            ],
            if (html == null || html.trim().isEmpty)
              Text(
                '该订阅没有提供正文，请打开原文阅读。',
                style: Theme.of(context).textTheme.bodyLarge,
              )
            else
              HtmlWidget(
                _sanitizeArticleHtml(html),
                factoryBuilder: () => ArticleWidgetFactory(
                  referer: referer?.toString(),
                  onImageTap: (url) async {
                    final uri = Uri.tryParse(url);
                    if (uri != null) {
                      await ImageViewerPage.show(
                        context,
                        url: uri,
                        referer: referer,
                      );
                    }
                  },
                ),
                textStyle: Theme.of(context).textTheme.bodyLarge
                    ?.copyWith(fontSize: _fontSize, height: _lineHeight),
                onTapUrl: (url) async {
                  await _openUrl(Uri.tryParse(url));
                  return true;
                },
              ),
            // Translated article panel — shown AFTER the original content
            // as a natural continuation, not a separate card.
            if (_translatedArticle.isNotEmpty) ...[
              const SizedBox(height: 24),
              Row(
                children: [
                  Container(
                    width: 3,
                    height: 16,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _translatingArticle
                        ? '翻译中 · ${(_translationProgress * 100).toInt()}%'
                        : '全文翻译',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                _translatedArticle,
                style: Theme.of(context).textTheme.bodyLarge
                    ?.copyWith(height: _lineHeight, fontSize: _fontSize),
              ),
            ],
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

/// Renders remote article images with the page URL as Referer; many
/// site CDNs reject image requests without it.
final class ArticleWidgetFactory extends WidgetFactory {
  ArticleWidgetFactory({this.referer, this.onImageTap});

  final String? referer;
  final void Function(String url)? onImageTap;

  @override
  ImageProvider? imageProviderFromNetwork(String url) {
    final referer = this.referer;
    return NetworkImage(
      url,
      headers: referer == null ? null : {'Referer': referer},
    );
  }

  @override
  Widget? buildImageWidget(BuildTree tree, ImageSource src) {
    final image = super.buildImageWidget(tree, src);
    if (image == null || onImageTap == null) return image;
    return GestureDetector(
      onTap: () {
        final url = src.url;
        if (url.isNotEmpty) onImageTap!(url);
      },
      child: image,
    );
  }
}

/// Removes active/embedded content that has no place in a reader view.
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
