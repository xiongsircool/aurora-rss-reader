import 'dart:convert';
import 'dart:typed_data';

import 'package:aurora_mobile/app/aurora_app.dart';
import 'package:aurora_mobile/application/ports/feed_http_client.dart';
import 'package:aurora_mobile/application/use_cases/refresh_feed.dart';
import 'package:aurora_mobile/data/database/local_database.dart';
import 'package:aurora_mobile/data/repositories/local_content_repository.dart';
import 'package:aurora_mobile/features/reader/mobile_reader_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late LocalDatabase database;
  late _FakeFeedHttpClient httpClient;
  late MobileReaderController controller;

  setUp(() {
    database = LocalDatabase.memory();
    httpClient = _FakeFeedHttpClient();
    final repository = LocalContentRepository(database);
    controller = MobileReaderController(
      repository: repository,
      refreshFeed: RefreshFeed(httpClient: httpClient, repository: repository),
    );
  });

  tearDown(() async {
    httpClient.close();
    await database.close();
  });

  testWidgets('moves from empty inbox to sources and settings', (tester) async {
    await tester.pumpWidget(AuroraApp(controller: controller));
    await tester.pumpAndSettle();

    expect(find.text('Aurora'), findsOneWidget);
    expect(find.text('收件箱为空'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.rss_feed_outlined));
    await tester.pumpAndSettle();
    expect(find.text('还没有订阅源'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.settings_outlined));
    await tester.pumpAndSettle();
    expect(find.text('数据模式'), findsOneWidget);
    expect(find.text('本地模式'), findsOneWidget);
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

  @override
  Future<FeedHttpResponse> get(
    Uri uri, {
    Duration timeout = const Duration(seconds: 20),
    int maxBytes = 10 * 1024 * 1024,
  }) async {
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
  void close() {
    closed = true;
  }
}
