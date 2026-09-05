import 'package:aurora_mobile/data/database/local_database.dart';
import 'package:aurora_mobile/data/repositories/local_content_repository.dart';
import 'package:aurora_mobile/domain/entities/feed.dart';
import 'package:aurora_mobile/domain/feed_parsing/parsed_feed.dart';
import 'package:aurora_mobile/domain/value_objects/feed_view_type.dart';
import 'package:drift/drift.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('50k entry SQLite benchmark', () async {
    final openWatch = Stopwatch()..start();
    final database = LocalDatabase.memory();
    final repository = LocalContentRepository(database);
    await repository.saveFeed(
      Feed(
        id: 'benchmark-feed',
        title: 'Benchmark Feed',
        url: Uri.parse('https://example.com/benchmark.xml'),
        viewType: FeedViewType.articles,
      ),
    );
    openWatch.stop();
    addTearDown(database.close);

    const total = 50000;
    const chunkSize = 1000;
    final seedWatch = Stopwatch()..start();
    for (var start = 0; start < total; start += chunkSize) {
      final now = DateTime.utc(2026, 9, 3);
      await database.batch((batch) {
        batch.insertAll(database.entries, [
          for (var index = start; index < start + chunkSize; index++)
            EntriesCompanion.insert(
              id: 'benchmark-entry-$index',
              feedId: 'benchmark-feed',
              guid: 'benchmark-guid-$index',
              title: Value('Article $index'),
              summary: Value(
                index == total - 1
                    ? 'unique benchmark needle'
                    : 'benchmark summary',
              ),
              content: const Value('local first RSS content'),
              publishedAt: Value(now.subtract(Duration(minutes: index))),
              insertedAt: now,
            ),
        ]);
      });
    }
    seedWatch.stop();

    final firstPageWatch = Stopwatch()..start();
    final firstPage = await repository.listInbox(limit: 50);
    firstPageWatch.stop();

    var cursor = firstPage.nextCursor;
    var deepPage = firstPage;
    final deepPageWatch = Stopwatch()..start();
    for (var page = 1; page < 100 && cursor != null; page++) {
      deepPage = await repository.listInbox(cursor: cursor, limit: 50);
      cursor = deepPage.nextCursor;
    }
    deepPageWatch.stop();

    final searchWatch = Stopwatch()..start();
    final searchResults = await repository.search('unique benchmark needle');
    searchWatch.stop();

    final normalizedItems = [
      for (var index = 0; index < 200; index++)
        ParsedEntry(
          guid: 'normalized-$index',
          title: 'Normalized article $index',
          contentHtml: '<p>Normalized content $index</p>',
          publishedAt: DateTime.utc(
            2026,
            9,
            3,
            12,
          ).subtract(Duration(minutes: index)),
        ),
    ];
    final normalizedWatch = Stopwatch()..start();
    final inserted = await repository.insertParsedEntries(
      'benchmark-feed',
      normalizedItems,
    );
    normalizedWatch.stop();

    final count = await database.entries.count().getSingle();
    expect(count, total + 200);
    expect(firstPage.entries, hasLength(50));
    expect(deepPage.entries, hasLength(50));
    expect(searchResults.single.id, 'benchmark-entry-${total - 1}');
    expect(inserted, 200);

    // ignore: avoid_print
    print(
      'SQLITE_BENCHMARK '
      'open_ms=${openWatch.elapsedMilliseconds} '
      'seed_50k_ms=${seedWatch.elapsedMilliseconds} '
      'first_page_ms=${firstPageWatch.elapsedMicroseconds / 1000} '
      'pages_2_to_100_ms=${deepPageWatch.elapsedMilliseconds} '
      'fts_search_ms=${searchWatch.elapsedMicroseconds / 1000} '
      'insert_200_ms=${normalizedWatch.elapsedMilliseconds}',
    );
  }, timeout: const Timeout(Duration(minutes: 3)));
}
