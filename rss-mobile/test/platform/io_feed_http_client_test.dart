import 'dart:convert';
import 'dart:io';

import 'package:aurora_mobile/platform/http/io_feed_http_client.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late HttpServer server;
  late Uri baseUri;

  setUp(() async {
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    baseUri = Uri.parse('http://${server.address.host}:${server.port}');
    server.listen((request) async {
      switch (request.uri.path) {
        case '/feed':
          request.response.headers.set(
            HttpHeaders.contentTypeHeader,
            'application/rss+xml; charset=utf-8',
          );
          request.response.add(<int>[0x3c, 0x72, 0x73, 0x73, 0x3e]);
        case '/redirect':
          request.response.redirect(baseUri.resolve('/feed'));
        case '/large':
          request.response.add(List<int>.filled(64, 0x61));
        case '/gzip':
          request.response.headers.set(
            HttpHeaders.contentEncodingHeader,
            'gzip',
          );
          request.response.add(gzip.encode(utf8.encode('<rss>gzip</rss>')));
        case '/deflate':
          request.response.headers.set(
            HttpHeaders.contentEncodingHeader,
            'deflate',
          );
          request.response.add(zlib.encode(utf8.encode('<rss>deflate</rss>')));
        default:
          request.response.statusCode = HttpStatus.internalServerError;
      }
      await request.response.close();
    });
  });

  tearDown(() async {
    await server.close(force: true);
  });

  test('keeps raw bytes and response headers', () async {
    final client = IoFeedHttpClient();
    addTearDown(client.close);

    final response = await client.get(baseUri.resolve('/feed'));

    expect(response.body, <int>[0x3c, 0x72, 0x73, 0x73, 0x3e]);
    expect(response.header('content-type'), contains('application/rss+xml'));
    expect(response.finalUri.path, '/feed');
  });

  test('follows redirects and reports the final URI', () async {
    final client = IoFeedHttpClient();
    addTearDown(client.close);

    final response = await client.get(baseUri.resolve('/redirect'));

    expect(response.statusCode, HttpStatus.ok);
    expect(response.finalUri.path, '/feed');
  });

  test('automatically decompresses gzip and deflate responses', () async {
    final client = IoFeedHttpClient();
    addTearDown(client.close);

    final gzipResponse = await client.get(baseUri.resolve('/gzip'));
    final deflateResponse = await client.get(baseUri.resolve('/deflate'));

    expect(utf8.decode(gzipResponse.body), '<rss>gzip</rss>');
    expect(utf8.decode(deflateResponse.body), '<rss>deflate</rss>');
  });

  test('rejects non-success responses', () async {
    final client = IoFeedHttpClient();
    addTearDown(client.close);

    await expectLater(
      client.get(baseUri.resolve('/error')),
      throwsA(
        isA<FeedHttpException>().having(
          (error) => error.statusCode,
          'statusCode',
          HttpStatus.internalServerError,
        ),
      ),
    );
  });

  test('rejects responses larger than the configured limit', () async {
    final client = IoFeedHttpClient();
    addTearDown(client.close);

    await expectLater(
      client.get(baseUri.resolve('/large'), maxBytes: 16),
      throwsA(isA<FeedHttpException>()),
    );
  });

  test('rejects unsupported URL schemes before opening a connection', () async {
    final client = IoFeedHttpClient();
    addTearDown(client.close);

    await expectLater(
      client.get(Uri.parse('file:///tmp/feed.xml')),
      throwsA(isA<FeedHttpException>()),
    );
  });
}
