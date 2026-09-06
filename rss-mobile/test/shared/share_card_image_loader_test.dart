import 'dart:io';

import 'package:aurora_mobile/shared/share_card_image_loader.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final previousHttpOverride = HttpOverrides.current;
  HttpOverrides.global = null; // These tests use only a loopback HTTP server.
  tearDownAll(() => HttpOverrides.global = previousHttpOverride);
  late HttpServer server;
  late Uri base;
  late List<String> referers;

  setUp(() async {
    referers = [];
    final png = await File('assets/splash/logo.png').readAsBytes();
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    base = Uri.parse('http://${server.address.host}:${server.port}');
    server.listen((request) async {
      referers.add(request.headers.value(HttpHeaders.refererHeader) ?? '');
      switch (request.uri.path) {
        case '/image':
          request.response.add(png);
        case '/invalid':
          request.response.write('<html>not an image</html>');
        case '/slow':
          request.response.add([1]);
          await request.response.flush();
          return;
        default:
          request.response.statusCode = HttpStatus.notFound;
      }
      await request.response.close();
    });
  });

  tearDown(() => server.close(force: true));

  test(
    'falls back from missing/invalid covers and sends article referer',
    () async {
      final image = await loadShareCardImage([
        base.resolve('/missing'),
        base.resolve('/invalid'),
        base.resolve('/image'),
      ], referer: Uri.parse('https://example.com/article'));
      expect(image, isNotNull);
      expect(image!.width, greaterThan(2));
      image.dispose();
      expect(referers, List.filled(3, 'https://example.com/article'));
    },
  );

  test('bad images do not prevent text-only sharing', () async {
    expect(await loadShareCardImage([base.resolve('/invalid')]), isNull);
    expect(await loadShareCardImage([]), isNull);
  });

  test('a stalled image download stops within the total budget', () async {
    final clock = Stopwatch()..start();
    final image = await loadShareCardImage([
      base.resolve('/slow'),
    ], timeout: const Duration(milliseconds: 150));
    expect(image, isNull);
    expect(clock.elapsed, lessThan(const Duration(seconds: 2)));
  });
}
