import 'package:aurora_mobile/application/use_cases/refresh_feed.dart';
import 'package:aurora_mobile/data/database/local_database.dart';
import 'package:aurora_mobile/data/repositories/local_content_repository.dart';
import 'package:aurora_mobile/domain/entities/feed.dart';
import 'package:aurora_mobile/domain/feed_parsing/parsed_feed.dart';
import 'package:aurora_mobile/features/reader/article_reader_page.dart';
import 'package:aurora_mobile/features/reader/mobile_reader_controller.dart';
import 'package:aurora_mobile/platform/http/io_feed_http_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('refresh repairs legacy cover-only attachments without losing reading state', () async {
    final database = LocalDatabase.memory();
    addTearDown(database.close);
    final repository = LocalContentRepository(database);
    await repository.saveFeed(
      Feed(
        id: 'feed',
        title: 'Podcast',
        url: Uri.parse('https://example.test/rss'),
      ),
    );
    final cover = ParsedEnclosure(
      url: Uri.parse('https://example.test/cover.jpg'),
      type: 'image/jpeg',
    );
    final audio = ParsedEnclosure(
      url: Uri.parse('https://example.test/audio.mp3'),
      type: 'audio/mpeg',
    );
    await repository.insertParsedEntries('feed', [
      ParsedEntry(guid: 'episode', title: 'Episode', enclosure: [cover]),
    ]);
    final old = (await repository.listInbox()).entries.single;
    await repository.markRead(old.id, read: true);
    await repository.setStarred(old.id, starred: true);
    expect(
      await repository.insertParsedEntries('feed', [
        ParsedEntry(
          guid: 'episode',
          title: 'Episode',
          enclosure: [cover, audio],
        ),
      ]),
      0,
    );
    final updated = (await repository.listInbox()).entries.single;
    expect(updated.id, old.id);
    expect(updated.enclosureUrl, audio.url);
    expect(updated.isRead, isTrue);
    expect(updated.isStarred, isTrue);
  });

  testWidgets(
    'audio takes precedence over cover and stays above long notes after auto-read',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final db = LocalDatabase.memory();
      final http = IoFeedHttpClient();
      final repository = LocalContentRepository(db);
      final controller = MobileReaderController(
        repository: repository,
        refreshFeed: RefreshFeed(repository: repository, httpClient: http),
      );
      addTearDown(() async {
        http.close();
        await db.close();
      });
      final audio = Uri.parse('https://example.test/episode.mp3');
      await tester.runAsync(() async {
        await repository.saveFeed(
          Feed(
            id: 'feed',
            title: 'Podcast',
            url: Uri.parse('https://example.test/rss'),
          ),
        );
        await repository.insertParsedEntries('feed', [
          ParsedEntry(
            guid: 'episode',
            title: 'A podcast episode',
            contentHtml: '<p>${'Long show notes. ' * 200}</p>',
            enclosure: [
              ParsedEnclosure(
                url: Uri.parse('https://example.test/cover.jpg'),
                type: 'image/jpeg',
              ),
              ParsedEnclosure(url: audio, type: 'audio/mpeg'),
            ],
          ),
        ]);
        await controller.initialize();
      });
      expect(controller.entries.single.enclosureUrl, audio);
      await tester.pumpWidget(
        MaterialApp(
          home: ArticleReaderPage(
            entry: controller.entries.single,
            feedTitle: 'Podcast',
            controller: controller,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(controller.entries.single.isRead, isTrue);
      expect(
        find.byKey(const ValueKey('play-podcast')).hitTestable(),
        findsOneWidget,
      );
      expect(find.text('播放音频'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
