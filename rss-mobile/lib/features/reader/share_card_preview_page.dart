import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../shared/share_card_content.dart';
import '../../shared/share_card_image_loader.dart';
import '../../shared/share_card_renderer.dart';

class ShareCardPreviewPage extends StatefulWidget {
  const ShareCardPreviewPage({
    required this.title,
    required this.feed,
    required this.url,
    required this.content,
    this.referer,
    this.proxyUrl,
    super.key,
  });
  final String title;
  final String feed;
  final String url;
  final ShareCardContent content;
  final Uri? referer;
  final String? proxyUrl;

  @override
  State<ShareCardPreviewPage> createState() => _ShareCardPreviewPageState();
}

class _ShareCardPreviewPageState extends State<ShareCardPreviewPage> {
  late final TextEditingController _excerpt = TextEditingController(
    text: widget.content.excerpt,
  );
  final _shareKey = GlobalKey();
  Uint8List? _png;
  bool _busy = false;
  bool _dirty = true;
  bool _withImage = true;
  int _imageIndex = 0;
  String? _error;
  bool _imageUnavailable = false;

  @override
  void initState() {
    super.initState();
    _generate();
  }

  @override
  void dispose() {
    _excerpt.dispose();
    super.dispose();
  }

  Future<void> _generate() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    ui.Image? image;
    try {
      if (_withImage && widget.content.images.isNotEmpty) {
        image = await loadShareCardImage(
          [widget.content.images[_imageIndex]],
          referer: widget.referer,
          proxyUrl: widget.proxyUrl,
        );
      }
      if (!mounted) return;
      final png = await ShareCardRenderer(
        title: widget.title,
        feed: widget.feed,
        url: widget.url,
        excerpt: _excerpt.text,
        articleImage: image,
      ).renderPng();
      if (mounted) {
        setState(() {
          _png = png;
          _dirty = false;
          _imageUnavailable =
              _withImage && widget.content.images.isNotEmpty && image == null;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(
          () =>
              _error = error is FormatException ? error.message : '预览生成失败，请重试',
        );
      }
    } finally {
      image?.dispose();
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _share() async {
    final png = _png;
    if (_busy || _dirty || png == null) return;
    final box = _shareKey.currentContext?.findRenderObject() as RenderBox?;
    final origin = box == null
        ? const Rect.fromLTWH(1, 1, 1, 1)
        : box.localToGlobal(Offset.zero) & box.size;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final temp = await getTemporaryDirectory();
      final folder = await temp.createTemp('aurora-card-');
      final file = await File('${folder.path}/Aurora.png').writeAsBytes(png);
      if (!mounted) return;
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile(file.path, mimeType: 'image/png')],
          subject: widget.title,
          sharePositionOrigin: origin,
        ),
      );
    } catch (_) {
      if (mounted) setState(() => _error = '无法保存图片或打开系统分享面板，请重试');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('分享预览')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720),
          child: ListView(
            padding: EdgeInsets.fromLTRB(
              20,
              12,
              20,
              MediaQuery.paddingOf(context).bottom + 24,
            ),
            children: [
              Text('图文摘要', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 4),
              const Text('确认排版后分享图片，二维码指向文章原文。'),
              if (_busy)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: LinearProgressIndicator(minHeight: 2),
                ),
              if (_png != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 480),
                    child: Image.memory(
                      _png!,
                      fit: BoxFit.contain,
                      gaplessPlayback: true,
                      semanticLabel: '即将分享的卡片预览',
                    ),
                  ),
                ),
              if (_imageUnavailable) const Text('这张图片暂时无法读取，预览已使用纯文字；可以换一张图片。'),
              if (_error != null)
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              if (widget.content.images.isNotEmpty) ...[
                SwitchListTile.adaptive(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('包含配图'),
                  value: _withImage,
                  onChanged: _busy
                      ? null
                      : (value) => setState(() {
                          _withImage = value;
                          _dirty = true;
                        }),
                ),
                if (_withImage)
                  DropdownButtonFormField<int>(
                    initialValue: _imageIndex,
                    decoration: const InputDecoration(labelText: '文章配图'),
                    items: [
                      for (var i = 0; i < widget.content.images.length; i++)
                        DropdownMenuItem(value: i, child: Text('配图 ${i + 1}')),
                    ],
                    onChanged: _busy
                        ? null
                        : (value) => setState(() {
                            _imageIndex = value!;
                            _dirty = true;
                          }),
                  ),
              ],
              const SizedBox(height: 16),
              TextField(
                controller: _excerpt,
                enabled: !_busy,
                minLines: 3,
                maxLines: 6,
                maxLength: 600,
                decoration: const InputDecoration(
                  labelText: '分享摘要',
                  helperText: '卡片最多展示六行，较长内容会省略。',
                  border: OutlineInputBorder(),
                ),
                onChanged: (_) => setState(() => _dirty = true),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 12,
                runSpacing: 8,
                children: [
                  OutlinedButton.icon(
                    onPressed: _busy ? null : _generate,
                    icon: const Icon(Icons.refresh),
                    label: const Text('更新预览'),
                  ),
                  FilledButton.icon(
                    key: _shareKey,
                    onPressed: _busy || _dirty || _png == null ? null : _share,
                    icon: const Icon(Icons.ios_share),
                    label: const Text('分享这张图片'),
                  ),
                ],
              ),
              if (_dirty && _png != null)
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: Text('内容已修改，请先更新预览。'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
