import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/rendering.dart';
import 'package:path_provider/path_provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

/// Renders a branded share-card image (title, excerpt, QR code, brand
/// footer) so the article can be shared to chat apps as a rich-looking
/// picture instead of plain text.
class ShareCardRenderer {
  const ShareCardRenderer({
    required this.title,
    required this.feed,
    required this.url,
    this.excerpt,
  });

  final String title;
  final String feed;
  final String url;
  final String? excerpt;

  static const _width = 1080.0;
  static const _auroraOrange = Color(0xFFE85D24);
  static const _auroraTeal = Color(0xFF087E8B);
  static const _ink = Color(0xFF202124);
  static const _muted = Color(0xFF8A9199);

  /// Renders and returns the PNG file, or null if rendering failed.
  Future<File?> render() async {
    try {
      final recorder = ui.PictureRecorder();
      final canvas = ui.Canvas(recorder);

      _paintCard(canvas);

      final picture = recorder.endRecording();
      final image = await picture.toImage(_width.round(), 1520);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      image.dispose();

      if (bytes == null) return null;
      final dir = await getTemporaryDirectory();
      final file = File(
        '${dir.path}/aurora-card-${DateTime.now().millisecondsSinceEpoch}.png',
      );
      await file.writeAsBytes(bytes.buffer.asUint8List());
      return file;
    } catch (_) {
      return null;
    }
  }

  void _paintCard(ui.Canvas canvas) {
    const w = _width;
    // Background
    canvas.drawRect(
      const Rect.fromLTWH(0, 0, w, 1520),
      ui.Paint()..color = const Color(0xFFF6F7F9),
    );
    // Brand top bar
    canvas.drawRect(
      const Rect.fromLTWH(0, 0, w, 14),
      ui.Paint()..color = _auroraOrange,
    );
    // Feed source row
    _drawText(
      canvas,
      feed.toUpperCase(),
      const Offset(64, 74),
      fontSize: 34,
      color: _auroraTeal,
      fontWeight: FontWeight.w700,
      letterSpacing: 3,
    );
    // Title (up to 4 lines)
    _drawText(
      canvas,
      title,
      const Offset(64, 150),
      fontSize: 68,
      color: _ink,
      fontWeight: FontWeight.w800,
      maxWidth: w - 128,
      maxLines: 4,
    );
    // Excerpt (up to 5 lines)
    final excerptY = 640.0;
    if (excerpt != null && excerpt!.trim().isNotEmpty) {
      _drawText(
        canvas,
        excerpt!,
        Offset(64, excerptY),
        fontSize: 42,
        color: const Color(0xFF4A4F55),
        fontWeight: FontWeight.w400,
        maxWidth: w - 128,
        maxLines: 5,
        lineHeight: 1.5,
      );
    }
    // QR code block
    _drawQr(canvas, const Offset(64, 1130), 300);
    _drawText(
      canvas,
      '扫码或点击阅读原文',
      const Offset(404, 1210),
      fontSize: 34,
      color: _muted,
    );
    _drawText(
      canvas,
      _ellipsize(url, 46),
      const Offset(404, 1262),
      fontSize: 30,
      color: _muted,
    );
    // Brand footer
    canvas.drawRect(
      const Rect.fromLTWH(0, 1470, w, 50),
      ui.Paint()..color = _auroraTeal.withValues(alpha: 0.12),
    );
    _drawText(
      canvas,
      'Aurora · 本地优先 RSS 阅读器',
      const Offset(64, 1480),
      fontSize: 30,
      color: _auroraTeal,
      fontWeight: FontWeight.w600,
    );
  }

  Future<void> _drawQr(ui.Canvas canvas, Offset offset, double size) async {
    try {
      final painter = QrPainter(
        data: url,
        version: QrVersions.auto,
        gapless: true,
        eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: _ink),
        dataModuleStyle: const QrDataModuleStyle(
          dataModuleShape: QrDataModuleShape.square,
          color: _ink,
        ),
      );
      final qrImage = await painter.toImage(size);
      final src = Rect.fromLTWH(
        0,
        0,
        qrImage.width.toDouble(),
        qrImage.height.toDouble(),
      );
      final dst = Rect.fromLTWH(offset.dx, offset.dy, size, size);
      canvas.drawImageRect(
        qrImage,
        src,
        dst,
        ui.Paint()..filterQuality = FilterQuality.high,
      );
      qrImage.dispose();
    } catch (_) {
      // QR failure should not break the whole card.
    }
  }

  void _drawText(
    ui.Canvas canvas,
    String text,
    Offset offset, {
    required double fontSize,
    required Color color,
    FontWeight fontWeight = FontWeight.w400,
    double letterSpacing = 0,
    double maxWidth = _width - 128,
    int maxLines = 1,
    double lineHeight = 1.3,
  }) {
    final tp = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          fontSize: fontSize,
          color: color,
          fontWeight: fontWeight,
          letterSpacing: letterSpacing,
          height: lineHeight,
        ),
      ),
      textAlign: TextAlign.left,
      maxLines: maxLines,
      ellipsis: maxLines > 1 ? '…' : null,
      textDirection: TextDirection.ltr,
    );
    tp.layout(maxWidth: maxWidth);
    tp.paint(canvas, offset);
  }

  static String _ellipsize(String text, int max) =>
      text.length <= max ? text : '${text.substring(0, max)}…';
}
