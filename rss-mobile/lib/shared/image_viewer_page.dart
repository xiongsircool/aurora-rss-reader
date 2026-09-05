import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

/// Full-screen image viewer with pinch-to-zoom and double-tap zoom.
class ImageViewerPage extends StatefulWidget {
  const ImageViewerPage({
    required this.url,
    this.referer,
    this.heroTag,
    super.key,
  });

  final Uri url;
  final Uri? referer;
  final String? heroTag;

  static Future<void> show(
    BuildContext context, {
    required Uri url,
    Uri? referer,
    String? heroTag,
  }) {
    return Navigator.of(context).push(
      PageRouteBuilder(
        opaque: false,
        barrierColor: Colors.black,
        pageBuilder: (_, _, _) =>
            ImageViewerPage(url: url, referer: referer, heroTag: heroTag),
        transitionsBuilder: (_, animation, _, child) =>
            FadeTransition(opacity: animation, child: child),
      ),
    );
  }

  @override
  State<ImageViewerPage> createState() => _ImageViewerPageState();
}

class _ImageViewerPageState extends State<ImageViewerPage> {
  final _transformationController = TransformationController();

  @override
  void dispose() {
    _transformationController.dispose();
    super.dispose();
  }

  void _handleDoubleTap(TapDownDetails details) {
    final position = _transformationController.toScene(details.localPosition);
    if (_transformationController.value != Matrix4.identity()) {
      _transformationController.value = Matrix4.identity();
    } else {
      _transformationController.value = Matrix4(
        3,
        0,
        0,
        0,
        0,
        3,
        0,
        0,
        0,
        0,
        1,
        0,
        -position.dx * 2,
        -position.dy * 2,
        0,
        1,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final referer = widget.referer;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: '保存到相册',
            onPressed: () async {
              ScaffoldMessenger.of(context)
                  .showSnackBar(const SnackBar(content: Text('长按图片可使用系统分享保存')));
            },
            icon: const Icon(Icons.save_alt),
          ),
        ],
      ),
      body: GestureDetector(
        onDoubleTapDown: _handleDoubleTap,
        onDoubleTap: () {
          // Handled in onDoubleTapDown via controller.
        },
        child: InteractiveViewer(
          transformationController: _transformationController,
          maxScale: 8,
          minScale: 0.5,
          child: Center(
            child: CachedNetworkImage(
              imageUrl: widget.url.toString(),
              httpHeaders: referer == null
                  ? null
                  : {'Referer': referer.toString()},
              fit: BoxFit.contain,
              errorWidget: (_, _, _) => const Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.broken_image_outlined,
                    color: Colors.white38,
                    size: 48,
                  ),
                  SizedBox(height: 12),
                  Text('图片加载失败', style: TextStyle(color: Colors.white38)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
