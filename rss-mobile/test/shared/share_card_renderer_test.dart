import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:aurora_mobile/shared/share_card_renderer.dart';
import 'package:flutter/services.dart';
import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qr_flutter/qr_flutter.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<ui.Image> decode(List<int> bytes) async {
    final buffer = await ui.ImmutableBuffer.fromUint8List(
      Uint8List.fromList(bytes),
    );
    final descriptor = await ui.ImageDescriptor.encoded(buffer);
    final codec = await descriptor.instantiateCodec();
    try {
      return (await codec.getNextFrame()).image;
    } finally {
      codec.dispose();
      descriptor.dispose();
      buffer.dispose();
    }
  }

  test('render saves readable PNGs in unique child directories', () async {
    final temp = await Directory.systemTemp.createTemp('aurora-share-test-');
    const channel = MethodChannel('plugins.flutter.io/path_provider');
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    messenger.setMockMethodCallHandler(channel, (call) async {
      expect(call.method, 'getTemporaryDirectory');
      return temp.path;
    });
    addTearDown(() async {
      messenger.setMockMethodCallHandler(channel, null);
      await temp.delete(recursive: true);
    });
    const renderer = ShareCardRenderer(
      title: 'Saved card',
      feed: 'Source',
      url: 'https://example.com/article',
    );
    final files = await Future.wait([renderer.render(), renderer.render()]);
    expect(files[0].path, isNot(files[1].path));
    for (final file in files) {
      expect(file.parent.parent.path, temp.path);
      expect(await file.exists(), isTrue);
      final image = await decode(await file.readAsBytes());
      expect(image.width, 1080);
      image.dispose();
    }
  });

  for (final url in [
    'https://example.com/posts/article?from=aurora&lang=zh',
    'https://example.com/${'article-' * 50}',
  ]) {
    test(
      'exported PNG contains every QR module and white quiet zone (${url.length})',
      () async {
        final bytes = await ShareCardRenderer(
          title: 'An article about reading',
          feed: 'Example',
          url: url,
        ).renderPng();
        final image = await decode(bytes);
        addTearDown(image.dispose);
        final pixels = (await image.toByteData())!;
        final code = QrCode.fromData(
          data: url,
          errorCorrectLevel: QrErrorCorrectLevel.M,
        );
        final matrix = QrImage(code);
        final module = math.max(3, (320 / (code.moduleCount + 8)).floor());
        final size = (code.moduleCount + 8) * module;
        final x0 = image.width - 64 - size;
        final y0 = image.height - 64 - size;
        int red(int x, int y) => pixels.getUint8((y * image.width + x) * 4);
        for (var y = 0; y < size; y++) {
          expect(red(x0 + module, y0 + y), 255, reason: 'left quiet zone');
          expect(
            red(x0 + size - module, y0 + y),
            255,
            reason: 'right quiet zone',
          );
        }
        for (var y = 0; y < code.moduleCount; y++) {
          for (var x = 0; x < code.moduleCount; x++) {
            expect(
              red(
                    x0 + (x + 4) * module + module ~/ 2,
                    y0 + (y + 4) * module + module ~/ 2,
                  ) <
                  100,
              matrix.isDark(y, x),
              reason: 'QR module $x,$y',
            );
          }
        }
        final output = Platform.environment['AURORA_SHARE_TEST_OUTPUT'];
        if (output != null) {
          await Directory(output).create(recursive: true);
          await File('$output/qr-${url.length}.png').writeAsBytes(bytes);
        }
      },
    );
  }

  test(
    'card height responds to content; very long content stays bounded',
    () async {
      final short = await decode(
        await const ShareCardRenderer(
          title: 'Short',
          feed: 'Source',
          url: '',
        ).renderPng(),
      );
      final long = await decode(
        await ShareCardRenderer(
          title: '长标题中文 English ' * 300,
          feed: 'Long source ' * 50,
          excerpt: 'Long paragraph ' * 1000,
          url: 'https://example.com/',
        ).renderPng(),
      );
      addTearDown(short.dispose);
      addTearDown(long.dispose);
      expect(short.width, 1080);
      expect(short.height, lessThan(700));
      expect(long.height, greaterThan(short.height));
      expect(long.height, lessThan(2200));
    },
  );

  test(
    'portrait article image is preserved and QR still fits below it',
    () async {
      final recorder = ui.PictureRecorder();
      final canvas = Canvas(recorder);
      canvas.drawRect(
        const Rect.fromLTWH(0, 0, 100, 200),
        Paint()..color = const Color(0xFFFF0000),
      );
      final picture = recorder.endRecording();
      final cover = await picture.toImage(100, 200);
      picture.dispose();
      addTearDown(cover.dispose);
      final output = await decode(
        await ShareCardRenderer(
          title: 'Portrait',
          feed: 'Source',
          url: 'https://example.com/',
          articleImage: cover,
        ).renderPng(),
      );
      addTearDown(output.dispose);
      final data = (await output.toByteData())!;
      var count = 0;
      for (var i = 0; i < data.lengthInBytes; i += 4) {
        if (data.getUint8(i) == 255 &&
            data.getUint8(i + 1) == 0 &&
            data.getUint8(i + 2) == 0) {
          count++;
        }
      }
      expect(
        count,
        310 * 620,
      ); // Entire 1:2 image, fitted within the height limit.
    },
  );

  test(
    'invalid or unencodable URLs fail explicitly instead of losing QR silently',
    () async {
      for (final url in [
        'file:///private/data',
        'https://example.com/${'x' * 6000}',
      ]) {
        await expectLater(
          ShareCardRenderer(title: 'Test', feed: '', url: url).renderPng(),
          throwsA(isA<FormatException>()),
        );
      }
    },
  );
}
