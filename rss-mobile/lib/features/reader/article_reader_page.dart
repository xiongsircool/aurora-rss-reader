import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/rendering.dart' show RenderRepaintBoundary;
import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import 'package:path_provider/path_provider.dart';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import 'package:flutter_widget_from_html_core/flutter_widget_from_html_core.dart';
import 'package:html2md/html2md.dart' as html2md;
import 'package:share_plus/share_plus.dart';

import '../../shared/share_card_content.dart';
import 'share_card_preview_page.dart';

import 'package:html/dom.dart' as html;
import 'package:html/parser.dart' as html_parser;
import 'package:url_launcher/url_launcher.dart';

import '../../data/repositories/reader_prefs_repository.dart';
import '../../domain/entities/entry.dart';
import '../../shared/image_viewer_page.dart';
import '../../shared/reading_stats.dart';
import '../../shared/right_scrollbar.dart';
import '../reader/podcast_player_sheet.dart';
import '../reader/video_card.dart';
import '../reader/mobile_reader_controller.dart';

final class ArticleReaderPage extends StatefulWidget {
  const ArticleReaderPage({
    required this.entry,
    required this.feedTitle,
    required this.controller,
    this.referer,
    this.embedded = false,
    super.key,
  });

  final Entry entry;
  final bool embedded;
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
  bool _serif = false;
  final ScrollController _scrollController = ScrollController();
  DateTime? _lastSavedScrollAt;
  static const _scrollSaveInterval = Duration(seconds: 2);
  final GlobalKey _articleCaptureKey = GlobalKey();
  final GlobalKey _shareButtonKey = GlobalKey();
  bool _sharingCard = false;
  late final ReaderPrefsRepository _prefs;

  @override
  void initState() {
    super.initState();
    _entry = widget.entry;
    _translatedTitle = widget.entry.translatedTitle;
    _prefs = ReaderPrefsRepository(widget.controller.repository.database);
    _prefs.loadFontSize().then((v) {
      if (mounted) setState(() => _fontSize = v);
    });
    _prefs.loadFontFamily().then((v) {
      if (mounted) setState(() => _serif = v == 'serif');
    });
    _restoreScrollOffset();
    _scrollController.addListener(_maybeSaveScrollOffset);
    _prefs.loadLineHeight().then((v) {
      if (mounted) setState(() => _lineHeight = v);
    });
    if (!_entry.isRead) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _markRead());
    }
    _loadCachedSummary();
  }

  /// Restores the last reading position after the first layout settles.
  Future<void> _restoreScrollOffset() async {
    final saved = await _prefs.loadScrollOffset(_entry.id);
    if (saved == null || saved < 200 || !mounted) return;
    await WidgetsBinding.instance.endOfFrame;
    if (!mounted || !_scrollController.hasClients) return;
    final target = saved.clamp(0.0, _scrollController.position.maxScrollExtent);
    _scrollController.jumpTo(target);
  }

  /// Persists the scroll offset at most once every 2 seconds.
  void _maybeSaveScrollOffset() {
    if (!_scrollController.hasClients) return;
    final now = DateTime.now();
    final last = _lastSavedScrollAt;
    if (last != null && now.difference(last) < _scrollSaveInterval) return;
    _lastSavedScrollAt = now;
    _prefs.saveScrollOffset(_entry.id, _scrollController.offset);
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

  String get _shareTargetUrl => _entry.url?.toString() ?? '';

  void _showShareSheet() {
    final colorScheme = Theme.of(context).colorScheme;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheetContext) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(8, 0, 8, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final (icon, title, subtitle, onTap) in [
                (Icons.image_outlined, '分享卡片', '图文摘要', _shareCardImage),
                (Icons.link, '复制链接', '仅复制文章地址', _copyLink),
                (Icons.subject, '分享文本', '标题 + 链接，适合聊天发送', _shareText),
                (
                  Icons.format_align_left,
                  '分享 Markdown',
                  '保留标题、列表、链接等格式',
                  _shareMarkdown,
                ),
                (Icons.photo_camera, '分享截图', '当前阅读画面', _shareScreenshot),
              ])
                ListTile(
                  leading: Icon(icon, color: colorScheme.secondary),
                  title: Text(title),
                  subtitle: Text(
                    subtitle,
                    style: Theme.of(sheetContext).textTheme.bodySmall,
                  ),
                  onTap: () {
                    Navigator.pop(sheetContext);
                    onTap();
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  Rect get _shareOrigin {
    final box = _shareButtonKey.currentContext?.findRenderObject();
    if (box is RenderBox && box.hasSize) {
      return box.localToGlobal(Offset.zero) & box.size;
    }
    return const Rect.fromLTWH(1, 1, 1, 1);
  }

  Future<void> _shareCardImage() async {
    if (_sharingCard) return;
    final contentHtml = _showOriginal
        ? (_entry.content ?? _entry.summary)
        : (_entry.readabilityContent ?? _entry.content ?? _entry.summary);
    final baseUrl = !_showOriginal && _entry.readabilityContent != null
        ? (_entry.contentSourceUrl ?? _entry.url)
        : _entry.url;
    setState(() => _sharingCard = true);
    try {
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => ShareCardPreviewPage(
            title: _entry.title,
            feed: widget.feedTitle,
            url: _shareTargetUrl,
            content: ShareCardContent.fromHtml(
              html: contentHtml,
              cover: _entry.imageUrl,
              baseUrl: baseUrl,
            ),
            referer: baseUrl ?? widget.referer,
            proxyUrl: widget.controller.proxyUrl,
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _sharingCard = false);
    }
  }

  Future<void> _copyLink() async {
    if (_shareTargetUrl.isEmpty) return;
    await Clipboard.setData(ClipboardData(text: _shareTargetUrl));
    if (mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('链接已复制')));
    }
  }

  Future<void> _shareText() async {
    final text = _shareTargetUrl.isEmpty
        ? _entry.title
        : '${_entry.title}\n${_entry.url}';
    await SharePlus.instance.share(
      ShareParams(
        text: text,
        subject: _entry.title,
        sharePositionOrigin: _shareOrigin,
      ),
    );
  }

  Future<void> _shareMarkdown() async {
    final html = _entry.readabilityContent ?? _entry.content ?? _entry.summary;
    if (html == null || html.trim().isEmpty) {
      await _shareText();
      return;
    }
    final md = html2md.convert(html);
    final header = '# ${_entry.title}\n\n> 来自 ${widget.feedTitle}\n\n';
    final footer = _shareTargetUrl.isEmpty
        ? ''
        : '\n\n---\n原文：$_shareTargetUrl';
    await SharePlus.instance.share(
      ShareParams(
        text: '$header$md$footer',
        subject: _entry.title,
        sharePositionOrigin: _shareOrigin,
      ),
    );
  }

  Future<void> _shareScreenshot() async {
    try {
      final boundary =
          _articleCaptureKey.currentContext?.findRenderObject()
              as RenderRepaintBoundary?;
      if (boundary == null) return;
      final image = await boundary.toImage(pixelRatio: 2.0);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      image.dispose();
      if (bytes == null) return;
      final dir = await getTemporaryDirectory();
      final file = File(
        '${dir.path}/aurora-share-${DateTime.now().millisecondsSinceEpoch}.png',
      );
      await file.writeAsBytes(bytes.buffer.asUint8List());
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile(file.path)],
          text: '${_entry.title}\n${_entry.url}',
          subject: _entry.title,
          sharePositionOrigin: _shareOrigin,
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('截图生成失败：$e')));
      }
    }
  }

  void _showReaderSettingsSheet() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) => SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
            24,
            0,
            24,
            24 + MediaQuery.paddingOf(sheetContext).bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '阅读设置',
                style: Theme.of(sheetContext).textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 20),
              Text(
                '字号 · ${_fontSize.round()}',
                style: Theme.of(sheetContext).textTheme.labelLarge,
              ),
              Slider(
                value: _fontSize,
                min: 12,
                max: 24,
                divisions: 12,
                label: '${_fontSize.round()}',
                onChanged: (v) {
                  setSheetState(() {});
                  setState(() => _fontSize = v);
                },
                onChangeEnd: _prefs.saveFontSize,
              ),
              const SizedBox(height: 8),
              Text(
                '行距 · ${_lineHeight.toStringAsFixed(2)}',
                style: Theme.of(sheetContext).textTheme.labelLarge,
              ),
              Slider(
                value: _lineHeight,
                min: 1.3,
                max: 2.2,
                divisions: 18,
                label: _lineHeight.toStringAsFixed(2),
                onChanged: (v) {
                  setSheetState(() {});
                  setState(() => _lineHeight = v);
                },
                onChangeEnd: _prefs.saveLineHeight,
              ),
              const SizedBox(height: 16),
              Text('字体', style: Theme.of(sheetContext).textTheme.labelLarge),
              const SizedBox(height: 8),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'sans', label: Text('系统默认')),
                  ButtonSegment(value: 'serif', label: Text('衬线')),
                ],
                selected: {_serif ? 'serif' : 'sans'},
                onSelectionChanged: (selection) {
                  final family = selection.single;
                  setSheetState(() {});
                  setState(() => _serif = family == 'serif');
                  _prefs.saveFontFamily(family);
                },
              ),
            ],
          ),
        ),
      ),
    );
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
    if (_scrollController.hasClients) {
      _prefs.saveScrollOffset(_entry.id, _scrollController.offset);
    }
    _scrollController.dispose();
    _summarySub?.cancel();
    _translateSub?.cancel();
    super.dispose();
  }

  bool get _isVideoArticle {
    final url = _entry.url;
    if (url == null) return false;
    final host = url.host.replaceFirst('www.', '');
    return host == 'youtube.com' ||
        host == 'm.youtube.com' ||
        host == 'youtu.be' ||
        host == 'bilibili.com' ||
        host == 'm.bilibili.com' ||
        host == 'vimeo.com';
  }

  void _startArticleTranslation() {
    if (_translatingArticle) return;
    final content = _showOriginal
        ? (_entry.content ?? _entry.summary)
        : (_entry.readabilityContent ?? _entry.content ?? _entry.summary);
    if (content == null || content.trim().length < 30) return;

    setState(() {
      _translatingArticle = true;
      _bilingualHtml = null;
      _translationProgress = 0.0;
    });

    _translateSub = widget.controller
        .translateArticleImmersive(
          entryId: _entry.id,
          contentHtml: content,
          onBlockTranslated: (_, _) {},
        )
        .listen(
          (progressUpdate) {
            if (mounted) {
              setState(() {
                _translationProgress = progressUpdate.progress;
                if (progressUpdate.bilingualHtml != null) {
                  _bilingualHtml = progressUpdate.bilingualHtml!;
                }
              });
            }
          },
          onError: (error) {
            if (mounted) setState(() => _translatingArticle = false);
          },
          onDone: () {
            if (mounted) setState(() => _translatingArticle = false);
          },
        );
  }

  String? _translatedTitle;
  bool _translatingTitle = false;
  String? _bilingualHtml;
  bool _translatingArticle = false;
  double _translationProgress = 0.0;
  StreamSubscription<({double progress, String? bilingualHtml})>? _translateSub;

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
    final hasText = html != null && html.trim().length >= 30;
    final width = MediaQuery.sizeOf(context).width;
    final horizontal = width > 760 ? (width - 720) / 2 : 20.0;
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: !widget.embedded,
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
          PopupMenuButton<String>(
            tooltip: '文章操作',
            onSelected: (_) => _toggleRead(),
            itemBuilder: (_) => [
              PopupMenuItem(
                value: 'read',
                child: Text(_entry.isRead ? '标为未读' : '标为已读'),
              ),
            ],
          ),
          IconButton(
            key: _shareButtonKey,
            tooltip: _sharingCard ? '正在生成分享卡片' : '分享',
            icon: _sharingCard
                ? const SizedBox.square(
                    dimension: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.ios_share),
            onPressed: _sharingCard ? null : _showShareSheet,
          ),
          IconButton(
            tooltip: '阅读设置',
            icon: const Icon(Icons.tune),
            onPressed: _showReaderSettingsSheet,
          ),
        ],
      ),
      body: SelectionArea(
        child: RepaintBoundary(
          key: _articleCaptureKey,
          child: RightScrollbar(
            controller: _scrollController,
            child: ListView(
              controller: _scrollController,
              padding: EdgeInsets.fromLTRB(
                horizontal,
                12,
                horizontal,
                24 + MediaQuery.paddingOf(context).bottom,
              ),
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
                Text(
                  [
                    readingTimeEstimate(html),
                    _metadata(_entry, widget.feedTitle),
                  ].where((part) => part.isNotEmpty).join(' · '),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 4,
                  runSpacing: 2,
                  children: [
                    if (hasText)
                      TextButton.icon(
                        key: const ValueKey('generate-ai-summary'),
                        onPressed: _summaryGenerating ? null : _startSummary,
                        icon: const Icon(Icons.auto_awesome_outlined, size: 18),
                        label: Text(_summaryGenerating ? '摘要生成中' : 'AI 摘要'),
                      ),
                    if (hasText)
                      TextButton.icon(
                        key: const ValueKey('translate-article'),
                        onPressed: _translatingArticle
                            ? null
                            : _startArticleTranslation,
                        icon: const Icon(Icons.translate, size: 18),
                        label: Text(
                          _translatingArticle
                              ? '翻译中 ${(_translationProgress * 100).round()}%'
                              : '翻译全文',
                        ),
                      ),
                    if (_entry.url != null && !_isVideoArticle && !hasExtracted)
                      TextButton.icon(
                        key: const ValueKey('extract-full-text'),
                        onPressed: _extracting ? null : _extractFullText,
                        icon: const Icon(Icons.article_outlined, size: 18),
                        label: Text(_extracting ? '正在提取' : '提取网页全文'),
                      ),
                    if (_translatedTitle == null)
                      TextButton.icon(
                        onPressed: _translatingTitle ? null : _translateTitle,
                        icon: const Icon(Icons.short_text, size: 18),
                        label: const Text('翻译标题'),
                      ),
                  ],
                ),
                if (_extracting || _summaryGenerating || _translatingArticle)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: LinearProgressIndicator(
                      value: _translatingArticle && _translationProgress > 0
                          ? _translationProgress
                          : null,
                      minHeight: 2,
                    ),
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
                                    color: Theme.of(context)
                                        .colorScheme
                                        .secondary,
                                    fontWeight: FontWeight.w600,
                                  ),
                            ),
                            const Spacer(),
                            if (_summaryGenerating)
                              const SizedBox.square(
                                dimension: 14,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
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
                if (!_isVideoArticle &&
                    _entry.contentExtractionStatus ==
                        ContentExtractionStatus.failed)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      '未能提取全文：${_friendlyExtractionError(_entry.contentExtractionError)}仍可阅读订阅内容或打开原文。',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ),
                if (hasExtracted)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      _showOriginal ? '显示订阅原文' : '网页全文已缓存',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: Theme.of(context).colorScheme.secondary,
                      ),
                    ),
                  ),
                if (html == null || html.trim().isEmpty)
                  Text(
                    _isVideoArticle
                        ? '视频内容请点击下方卡片观看。'
                        : '该订阅没有提供正文，请尝试提取全文或打开原文。',
                    style: Theme.of(context).textTheme.bodyLarge,
                  )
                else
                  HtmlWidget(
                    _sanitizeArticleHtml(_bilingualHtml ?? html),
                    customWidgetBuilder: (element) {
                      if (element.localName != 'pre') return null;
                      return _CodeBlockWidget(element: element);
                    },
                    customStylesBuilder: (element) {
                      if (element.className.contains('aurora-translation')) {
                        return {
                          'color': '#8b9bb4',
                          'font-style': 'italic',
                          'font-size': '0.92em',
                          'margin': '0.2em 0 0.6em 0',
                          'padding-left': '10px',
                          'border-left': '2px solid rgba(100,149,237,0.25)',
                        };
                      }
                      final tag = element.localName;
                      if (tag == 'pre') {
                        return {
                          'font-family': 'monospace',
                          'font-size': '0.86em',
                          'line-height': '1.5',
                          'background': 'rgba(127,127,127,0.10)',
                          'padding': '12px',
                          'border-radius': '8px',
                          'overflow-x': 'auto',
                        };
                      }
                      if (tag == 'code') {
                        return {
                          'font-family': 'monospace',
                          'font-size': '0.88em',
                          'background': 'rgba(127,127,127,0.10)',
                          'padding': '1px 5px',
                          'border-radius': '4px',
                        };
                      }
                      if (tag == 'blockquote') {
                        return {
                          'margin': '0.6em 0',
                          'padding': '2px 0 2px 12px',
                          'border-left': '3px solid rgba(127,127,127,0.30)',
                          'color': 'rgba(127,127,127,0.85)',
                        };
                      }
                      return null;
                    },
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
                    textStyle: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      fontSize: _fontSize,
                      height: _lineHeight,
                      fontFamily: _serif
                          ? (Theme.of(context).platform == TargetPlatform.iOS
                                ? 'Georgia'
                                : 'serif')
                          : null,
                    ),
                    onTapUrl: (url) async {
                      await _openUrl(Uri.tryParse(url));
                      return true;
                    },
                  ),
                // Translation progress indicator
                if (_translatingArticle) ...[
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SizedBox.square(
                        dimension: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          value: _translationProgress > 0
                              ? _translationProgress
                              : null,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '翻译中 · ${(_translationProgress * 100).toInt()}%',
                        style: Theme.of(context).textTheme.labelMedium
                            ?.copyWith(
                              color: Theme.of(context).colorScheme.primary,
                            ),
                      ),
                    ],
                  ),
                ],
                // Video card (when the article is a video link)
                if (_isVideoArticle) ...[
                  const SizedBox(height: 12),
                  VideoCard(
                    url: _entry.url!,
                    title: _entry.title,
                    referer: referer,
                  ),
                ],
                // Podcast player button (when audio enclosure exists)
                if (_entry.enclosureUrl != null &&
                    (_entry.enclosureType?.startsWith('audio/') ?? false)) ...[
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      key: const ValueKey('play-podcast'),
                      onPressed: () => PodcastPlayerSheet.show(
                        context,
                        title: _entry.title,
                        feedTitle: widget.feedTitle,
                        url: _entry.enclosureUrl!,
                        prefs: _prefs,
                      ),
                      icon: const Icon(Icons.headphones),
                      label: const Text('播放播客'),
                    ),
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
        ),
      ),
    );
  }
}

/// Translates raw extraction exceptions into short, human-readable
/// Chinese reasons shown in the reader.
String _friendlyExtractionError(String? raw) {
  if (raw == null || raw.trim().isEmpty) return '';
  final e = raw.toLowerCase();
  if (e.contains('timed out') || e.contains('timeout')) {
    return '站点响应超时，';
  }
  if (e.contains('反爬保护')) {
    return '该网站启用了反爬保护，';
  }
  if (e.contains('403') || e.contains('forbidden')) {
    return '站点拒绝访问（403），';
  }
  if (e.contains('socket') || e.contains('connection')) {
    return '网络连接失败，';
  }
  return '';
}

/// Renders a code block with horizontal scrolling and a copy button.
final class _CodeBlockWidget extends StatelessWidget {
  const _CodeBlockWidget({required this.element});

  final html.Element element;

  @override
  Widget build(BuildContext context) {
    final code = element.text.trimRight();
    final colorScheme = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              icon: const Icon(Icons.copy_rounded, size: 16),
              label: const Text('复制代码'),
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: code));
                if (context.mounted) {
                  ScaffoldMessenger.of(context)
                      .showSnackBar(const SnackBar(content: Text('代码已复制')));
                }
              },
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            child: Text(
              code,
              style: TextStyle(
                fontFamily: 'monospace',
                fontSize: 14,
                height: 1.5,
                color: colorScheme.onSurface,
              ),
            ),
          ),
        ],
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
