import 'dart:convert';
import 'dart:typed_data';

import 'package:aurora_mobile/app/aurora_app.dart';
import 'package:aurora_mobile/application/ports/feed_http_client.dart';
import 'package:aurora_mobile/application/use_cases/refresh_feed.dart';
import 'package:aurora_mobile/data/database/local_database.dart';
import 'package:aurora_mobile/data/repositories/local_content_repository.dart';
import 'package:aurora_mobile/domain/entities/feed.dart';
import 'package:aurora_mobile/domain/feed_parsing/parsed_feed.dart';
import 'package:aurora_mobile/features/reader/mobile_reader_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('navigates the four-tab mobile shell', (tester) async {
    final database = LocalDatabase.memory();
    final repository = LocalContentRepository(database);
    final httpClient = _FakeFeedHttpClient();
    final controller = MobileReaderController(
      repository: repository,
      refreshFeed: RefreshFeed(httpClient: httpClient, repository: repository),
    );
    addTearDown(() async {
      httpClient.close();
      await database.close();
    });

    await tester.pumpWidget(AuroraApp(controller: controller));
    await tester.pumpAndSettle();

    expect(find.text('收件箱为空'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.bookmark_border));
    await tester.pumpAndSettle();
    expect(find.text('暂无收藏文章'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.rss_feed_outlined));
    await tester.pumpAndSettle();
    expect(find.text('还没有订阅源'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.settings_outlined));
    await tester.pumpAndSettle();
    expect(find.text('数据模式'), findsOneWidget);
    expect(find.text('本地模式'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.inbox_outlined));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, '添加订阅'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('feed-url-input')),
      'https://example.com/integration.xml',
    );
    await tester.tap(find.byKey(const ValueKey('add-feed-submit')));
    await tester.pumpAndSettle();
    expect(find.text('Device integration article'), findsOneWidget);
    expect(find.text('Device Integration Feed'), findsOneWidget);
  });

  testWidgets('opens and writes the on-device SQLite database', (tester) async {
    final database = LocalDatabase.onDevice();
    addTearDown(database.close);
    final repository = LocalContentRepository(database);
    final suffix = DateTime.now().microsecondsSinceEpoch.toString();
    final feedId = 'integration-feed-$suffix';

    await repository.saveFeed(
      Feed(
        id: feedId,
        title: 'Integration Feed',
        url: Uri.parse('https://example.com/$suffix.xml'),
      ),
    );
    final inserted = await repository.insertParsedEntries(feedId, [
      ParsedEntry(guid: 'entry-$suffix', title: 'SQLite Native Asset'),
    ]);
    final page = await repository.listInbox(limit: 10);

    expect(inserted, 1);
    expect(page.entries.any((entry) => entry.feedId == feedId), isTrue);

    await repository.deleteFeed(feedId);
  });
}

final class _FakeFeedHttpClient implements FeedHttpClient {
  @override
  Future<FeedHttpResponse> get(
    Uri uri, {
    Duration timeout = const Duration(seconds: 20),
    int maxBytes = 10 * 1024 * 1024,
  }) async {
    const xml = '''
<rss version="2.0"><channel>
<title>Device Integration Feed</title>
<item><guid>device-1</guid><title>Device integration article</title></item>
</channel></rss>
''';
    return FeedHttpResponse(
      requestedUri: uri,
      finalUri: uri,
      statusCode: 200,
      headers: const {},
      body: Uint8List.fromList(utf8.encode(xml)),
    );
  }

  @override
  void close() {}
}
