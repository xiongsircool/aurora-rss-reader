import 'dart:convert';
import 'dart:typed_data';

import 'package:aurora_mobile/app/aurora_app.dart';
import 'package:aurora_mobile/application/ports/feed_http_client.dart';
import 'package:aurora_mobile/application/use_cases/extract_article.dart';
import 'package:aurora_mobile/application/use_cases/refresh_feed.dart';
import 'package:aurora_mobile/data/database/local_database.dart';
import 'package:aurora_mobile/data/repositories/local_content_repository.dart';
import 'package:aurora_mobile/features/reader/mobile_reader_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  late LocalDatabase database;
  late _FakeFeedHttpClient httpClient;
  late MobileReaderController controller;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    database = LocalDatabase.memory();
    httpClient = _FakeFeedHttpClient();
    final repository = LocalContentRepository(database);
    controller = MobileReaderController(
      repository: repository,
      refreshFeed: RefreshFeed(httpClient: httpClient, repository: repository),
      extractArticle: ExtractArticle(httpClient: httpClient),
    );
  });

  tearDown(() async {
    httpClient.close();
    await database.close();
  });

  testWidgets('moves from empty inbox to sources and settings', (tester) async {
    await tester.pumpWidget(AuroraApp(controller: controller));
    await tester.pumpAndSettle();

    expect(find.textContaining(RegExp('早上好|中午好|下午好|晚上好|夜深了')), findsOneWidget);
    expect(find.text('收件箱为空'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.rss_feed_outlined));
    await tester.pumpAndSettle();
    expect(find.text('还没有订阅源'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.settings_outlined));
    await tester.pumpAndSettle();
    expect(find.text('数据模式'), findsOneWidget);
    expect(find.text('本地模式'), findsOneWidget);
  });

  testWidgets('opens OPML import and export actions from settings', (
    tester,
  ) async {
    await tester.pumpWidget(AuroraApp(controller: controller));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.settings_outlined));
    await tester.pumpAndSettle();

    await tester.tap(find.text('OPML 导入与导出'));
    await tester.pumpAndSettle();

    expect(find.text('导入 OPML'), findsOneWidget);
    expect(find.text('导出 OPML'), findsOneWidget);
  });

  testWidgets('persists and applies a proxy from settings', (tester) async {
    await tester.pumpWidget(AuroraApp(controller: controller));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.settings_outlined));
    await tester.pumpAndSettle();

    await tester.tap(find.text('网络代理'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('proxy-url-input')),
      '127.0.0.1:7897',
    );
    await tester.tap(find.byKey(const ValueKey('proxy-save')));
    await tester.pumpAndSettle();

    expect(find.text('http://127.0.0.1:7897'), findsOneWidget);
    expect(httpClient.proxyUrl, 'http://127.0.0.1:7897');
    expect(
      (await database.select(database.userSettings).getSingle()).proxyUrl,
      'http://127.0.0.1:7897',
    );
  });

  testWidgets('searches local article content and opens the reader', (
    tester,
  ) async {
    await tester.pumpWidget(AuroraApp(controller: controller));
    await tester.pumpAndSettle();
    await controller.addFeed('https://example.com/feed.xml');
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('搜索'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('search-input')),
      'Fixture summary',
    );
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();

    expect(find.text('Fixture article'), findsOneWidget);
    await tester.tap(find.text('Fixture article'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(OutlinedButton, '打开原文'), findsOneWidget);
  });

  testWidgets('adds a feed and persists article actions from the UI', (
    tester,
  ) async {
    await tester.pumpWidget(AuroraApp(controller: controller));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilledButton, '添加订阅'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('feed-url-input')),
      'https://example.com/feed.xml',
    );
    await tester.tap(find.byKey(const ValueKey('add-feed-submit')));
    await tester.pumpAndSettle();

    expect(find.text('Fixture article'), findsOneWidget);
    expect(find.text('Fixture Feed'), findsOneWidget);

    await tester.tap(find.text('Fixture article'));
    await tester.pumpAndSettle();
    expect(find.text('Fixture summary', findRichText: true), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, '打开原文'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('extract-full-text')));
    await tester.pumpAndSettle();
    expect(find.text('网页全文已缓存'), findsOneWidget);
    expect(
      find.textContaining('Extracted full article', findRichText: true),
      findsWidgets,
    );

    await tester.pageBack();
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(Icons.star_border));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.bookmark_border));
    await tester.pumpAndSettle();

    expect(find.text('Fixture article'), findsOneWidget);
    expect(find.byTooltip('取消收藏'), findsOneWidget);
  });
}

final class _FakeFeedHttpClient implements FeedHttpClient {
  bool closed = false;
  String? proxyUrl;

  @override
  Future<FeedHttpResponse> get(
    Uri uri, {
    Duration timeout = const Duration(seconds: 20),
    int maxBytes = 10 * 1024 * 1024,
    String? accept,
  }) async {
    if (uri.path == '/article') {
      final paragraphs = List.generate(
        8,
        (index) =>
            '<p>Extracted full article paragraph $index contains enough '
            'meaningful content for the readability algorithm.</p>',
      ).join();
      final html =
          '<html><head><title>Extracted</title></head><body>'
          '<article><h1>Extracted</h1>$paragraphs</article></body></html>';
      return FeedHttpResponse(
        requestedUri: uri,
        finalUri: uri,
        statusCode: 200,
        headers: const {
          'content-type': ['text/html; charset=utf-8'],
        },
        body: Uint8List.fromList(utf8.encode(html)),
      );
    }

    const fixture = '''
<rss version="2.0"><channel>
  <title>Fixture Feed</title>
  <link>https://example.com</link>
  <item>
    <guid>fixture-1</guid>
    <title>Fixture article</title>
    <link>https://example.com/article</link>
    <description>Fixture summary</description>
    <pubDate>Thu, 03 Sep 2026 10:00:00 GMT</pubDate>
  </item>
</channel></rss>
''';
    return FeedHttpResponse(
      requestedUri: uri,
      finalUri: uri,
      statusCode: 200,
      headers: const {
        'content-type': ['application/rss+xml; charset=utf-8'],
      },
      body: Uint8List.fromList(utf8.encode(fixture)),
    );
  }

  @override
  void setProxyUrl(String? proxyUrl) {
    this.proxyUrl = proxyUrl;
  }

  @override
  void close() {
    closed = true;
  }
}
