import 'dart:io';

import 'package:aurora_mobile/application/use_cases/extract_article.dart';
import 'package:aurora_mobile/platform/http/io_feed_http_client.dart';
import 'package:charset/charset.dart' as charset;
import 'package:flutter_test/flutter_test.dart';

void main() {
  late HttpServer server;
  late Uri baseUri;
  late IoFeedHttpClient httpClient;
  late ExtractArticle extractArticle;

  setUp(() async {
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    baseUri = Uri.parse('http://${server.address.host}:${server.port}');
    server.listen((request) async {
      switch (request.uri.path) {
        case '/article':
          request.response.headers.contentType = ContentType.html;
          request.response.write(_articleHtml('Main article text'));
        case '/gbk':
          request.response.headers.set(
            HttpHeaders.contentTypeHeader,
            'text/html; charset=GBK',
          );
          const codec = charset.GbkCodec(allowMalformed: false);
          request.response.add(codec.encode(_articleHtml('中文网页正文内容')));
        case '/image':
          request.response.headers.contentType = ContentType('image', 'png');
          request.response.add([1, 2, 3]);
        case '/short':
          request.response.headers.contentType = ContentType.html;
          request.response.write('<html><body><p>short</p></body></html>');
        default:
          request.response.statusCode = HttpStatus.notFound;
      }
      await request.response.close();
    });

    httpClient = IoFeedHttpClient(useEnvironmentProxy: false);
    extractArticle = ExtractArticle(httpClient: httpClient);
  });

  tearDown(() async {
    httpClient.close();
    await server.close(force: true);
  });

  test('extracts the primary article and metadata', () async {
    final article = await extractArticle(baseUri.resolve('/article'));

    expect(article.title, 'Readable page');
    expect(article.byline, 'Aurora Author');
    expect(article.textContent, contains('Main article text'));
    expect(article.contentHtml, contains('paragraph 8'));
    expect(article.sourceUrl.path, '/article');
  });

  test('decodes GBK HTML before extraction', () async {
    final article = await extractArticle(baseUri.resolve('/gbk'));
    expect(article.textContent, contains('中文网页正文内容'));
  });

  test('rejects non-HTML responses', () async {
    await expectLater(
      extractArticle(baseUri.resolve('/image')),
      throwsA(isA<ArticleExtractionException>()),
    );
  });

  test('rejects pages without enough readable content', () async {
    await expectLater(
      extractArticle(baseUri.resolve('/short')),
      throwsA(isA<ArticleExtractionException>()),
    );
  });
}

String _articleHtml(String marker) {
  final paragraphs = List.generate(
    10,
    (index) =>
        '<p>$marker paragraph $index contains enough meaningful words for '
        'the readability algorithm to recognize this as the primary story.</p>',
  ).join();
  return '''
<!doctype html>
<html lang="en">
<head><title>Readable page</title><meta name="author" content="Aurora Author"></head>
<body>
<nav>Navigation links and unrelated menu items</nav>
<main><article><h1>Readable page</h1>$paragraphs</article></main>
<footer>Footer links</footer>
</body>
</html>
''';
}
