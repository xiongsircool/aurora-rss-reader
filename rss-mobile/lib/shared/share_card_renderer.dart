import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/rendering.dart';
import 'package:path_provider/path_provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

/// Produces a bounded, content-sized PNG. The caller owns [articleImage].
class ShareCardRenderer {
  const ShareCardRenderer({
    required this.title,
    required this.feed,
    required this.url,
    this.excerpt,
    this.articleImage,
    this.fontFamily,
  });

  final String title;
  final String feed;
  final String url;
  final String? excerpt;
  final ui.Image? articleImage;
  final String? fontFamily;

  static const _width = 1080.0;
  static const _padding = 64.0;
  static const _contentWidth = _width - 2 * _padding;
  static const _ink = Color(0xFF202124);
  static const _teal = Color(0xFF087E8B);
  static const _muted = Color(0xFF535A60);

  Future<File> render() async {
    final bytes = await renderPng();
    final directory = await getTemporaryDirectory();
    // Separate directories avoid filename collisions across concurrent shares.
    final folder = await directory.createTemp('aurora-card-');
    return File('${folder.path}/Aurora.png').writeAsBytes(bytes);
  }

  /// All canvas operations, including the QR code, finish before rasterization.
  Future<Uint8List> renderPng() async {
    final texts = <TextPainter>[];
    TextPainter text(
      String value,
      double size,
      int lines,
      Color color, {
      double width = _contentWidth,
      FontWeight weight = FontWeight.w400,
    }) {
      final painter = TextPainter(
        text: TextSpan(
          text: value.trim(),
          style: TextStyle(
            fontSize: size,
            fontFamily: fontFamily,
            fontWeight: weight,
            color: color,
            height: 1.4,
            letterSpacing: 0,
          ),
        ),
        maxLines: lines,
        ellipsis: '…',
        textDirection: TextDirection.ltr,
      )..layout(maxWidth: width);
      texts.add(painter);
      return painter;
    }

    ui.Picture? picture;
    ui.Image? output;
    try {
      final link = url.trim();
      QrPainter? qr;
      var qrSize = 0.0;
      var quietZone = 0.0;
      if (link.isNotEmpty) {
        if (utf8.encode(link).length > 2000) {
          throw const FormatException('文章链接过长，无法生成二维码，请使用文本分享');
        }
        final uri = Uri.tryParse(link);
        if (uri == null ||
            !['https', 'http'].contains(uri.scheme) ||
            uri.host.isEmpty) {
          throw const FormatException('文章链接无效，无法生成二维码');
        }
        final validation = QrValidator.validate(
          data: link,
          version: QrVersions.auto,
          errorCorrectionLevel: QrErrorCorrectLevel.M,
        );
        final code = validation.qrCode;
        if (!validation.isValid || code == null) {
          throw const FormatException('文章链接过长，无法生成二维码，请使用文本分享');
        }
        // Integer module size and four white modules on every edge keep the
        // QR crisp and scannable. Long URLs receive a larger QR, not blur.
        final module = math.max(3, (320 / (code.moduleCount + 8)).floor());
        quietZone = module * 4.0;
        qrSize = (code.moduleCount + 8) * module.toDouble();
        qr = QrPainter.withQr(
          qr: code,
          gapless: true,
          eyeStyle: const QrEyeStyle(eyeShape: QrEyeShape.square, color: _ink),
          dataModuleStyle: const QrDataModuleStyle(
            dataModuleShape: QrDataModuleShape.square,
            color: _ink,
          ),
        );
      }

      final source = text(feed, 30, 2, _teal, weight: FontWeight.w600);
      final heading = text(title, 58, 6, _ink, weight: FontWeight.w700);
      final description = (excerpt?.trim().isNotEmpty ?? false)
          ? text(excerpt!, 36, 6, _muted)
          : null;
      final footerWidth = _contentWidth - (qr == null ? 0 : qrSize + 40);
      final brand = text(
        'Aurora',
        42,
        1,
        _ink,
        width: footerWidth,
        weight: FontWeight.w600,
      );
      final caption = text(
        qr == null ? '文章分享' : '扫码阅读原文',
        30,
        1,
        _muted,
        width: footerWidth,
      );
      final host = qr == null
          ? null
          : text(Uri.parse(link).host, 26, 2, _muted, width: footerWidth);

      var y = _padding;
      final sourceY = y;
      y += source.height + 24;
      final headingY = y;
      y += heading.height;
      Rect? imageRect;
      final cover = articleImage;
      if (cover != null) {
        y += 32;
        final scale = math.min(_contentWidth / cover.width, 620 / cover.height);
        final size = Size(cover.width * scale, cover.height * scale);
        imageRect = Rect.fromLTWH(
          (_width - size.width) / 2,
          y,
          size.width,
          size.height,
        );
        y += size.height;
      }
      double? excerptY;
      if (description != null) {
        y += 32;
        excerptY = y;
        y += description.height;
      }
      y += 40;
      final dividerY = y;
      y += 32;
      final footerY = y;
      final footerTextHeight =
          brand.height +
          12 +
          caption.height +
          (host == null ? 0 : 12 + host.height);
      final footerHeight = math.max(qrSize, footerTextHeight);
      final height = (footerY + footerHeight + _padding).ceil();

      final recorder = ui.PictureRecorder();
      final canvas = Canvas(recorder);
      canvas.drawRect(
        Rect.fromLTWH(0, 0, _width, height.toDouble()),
        Paint()..color = const Color(0xFFFFFFFF),
      );
      canvas.drawRect(
        const Rect.fromLTWH(0, 0, _width, 8),
        Paint()..color = _teal,
      );
      source.paint(canvas, Offset(_padding, sourceY));
      heading.paint(canvas, Offset(_padding, headingY));
      if (cover != null && imageRect != null) {
        canvas.drawImageRect(
          cover,
          Rect.fromLTWH(0, 0, cover.width.toDouble(), cover.height.toDouble()),
          imageRect,
          Paint()..filterQuality = FilterQuality.medium,
        );
      }
      if (description != null && excerptY != null) {
        description.paint(canvas, Offset(_padding, excerptY));
      }
      canvas.drawLine(
        Offset(_padding, dividerY),
        Offset(_width - _padding, dividerY),
        Paint()
          ..color = const Color(0xFFE4E7E9)
          ..strokeWidth = 2,
      );
      var textY = footerY + (footerHeight - footerTextHeight) / 2;
      brand.paint(canvas, Offset(_padding, textY));
      textY += brand.height + 12;
      caption.paint(canvas, Offset(_padding, textY));
      if (host != null) {
        host.paint(canvas, Offset(_padding, textY + caption.height + 12));
      }
      if (qr != null) {
        canvas.save();
        canvas.translate(
          _width - _padding - qrSize + quietZone,
          footerY + quietZone,
        );
        qr.paint(canvas, Size.square(qrSize - quietZone * 2));
        canvas.restore();
      }
      picture = recorder.endRecording();
      output = await picture.toImage(_width.toInt(), height);
      final bytes = await output.toByteData(format: ui.ImageByteFormat.png);
      if (bytes == null) throw StateError('无法编码分享图片');
      return bytes.buffer.asUint8List(bytes.offsetInBytes, bytes.lengthInBytes);
    } finally {
      output?.dispose();
      picture?.dispose();
      for (final painter in texts) {
        painter.dispose();
      }
    }
  }
}
