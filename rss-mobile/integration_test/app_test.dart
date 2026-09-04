import 'package:aurora_mobile/app/aurora_app.dart';
import 'package:aurora_mobile/data/database/local_database.dart';
import 'package:aurora_mobile/data/repositories/local_content_repository.dart';
import 'package:aurora_mobile/domain/entities/feed.dart';
import 'package:aurora_mobile/domain/feed_parsing/parsed_feed.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('navigates the four-tab mobile shell', (tester) async {
    await tester.pumpWidget(const AuroraApp());
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
