import 'package:aurora_mobile/data/database/local_database.dart';
import 'package:aurora_mobile/data/repositories/local_content_repository.dart';
import 'package:aurora_mobile/domain/entities/feed.dart';
import 'package:aurora_mobile/domain/feed_parsing/parsed_feed.dart';
import 'package:aurora_mobile/domain/value_objects/feed_view_type.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late LocalDatabase database;
  late LocalContentRepository repository;

  setUp(() async {
    database = LocalDatabase.memory();
    repository = LocalContentRepository(database);
    await repository.saveFeed(
      Feed(
        id: 'feed-1',
        title: 'Test Feed',
        url: Uri.parse('https://example.com/feed.xml'),
        viewType: FeedViewType.articles,
      ),
    );
  });

  tearDown(() => database.close());

  test('creates all local-first tables', () async {
    final tables = await database
        .customSelect("SELECT name FROM sqlite_master WHERE type = 'table'")
        .get();
    final names = tables.map((row) => row.read<String>('name')).toSet();

    expect(
      names,
      containsAll(<String>{
        'feeds',
        'entries',
        'summaries',
        'translations',
        'user_settings',
        'user_tags',
        'entry_tags',
        'collections',
        'collection_entries',
        'entries_fts',
      }),
    );
    final version = await database
        .customSelect('PRAGMA user_version')
        .getSingle();
    expect(version.read<int>('user_version'), 2);
  });

  test('refreshing a feed preserves its creation timestamp', () async {
    final before = await database.select(database.feeds).getSingle();
    await Future<void>.delayed(const Duration(milliseconds: 2));
    await repository.saveFeed(
      Feed(
        id: 'feed-1',
        title: 'Updated Feed',
        url: Uri.parse('https://example.com/feed.xml'),
      ),
    );
    final after = await database.select(database.feeds).getSingle();

    expect(after.createdAt, before.createdAt);
    expect(after.updatedAt.isBefore(before.updatedAt), isFalse);
    expect(after.title, 'Updated Feed');
  });

  test('persists the singleton proxy setting', () async {
    expect(await repository.loadProxyUrl(), isNull);
    await repository.saveProxyUrl('http://127.0.0.1:7897');

    expect(await repository.loadProxyUrl(), 'http://127.0.0.1:7897');
    expect(await database.select(database.userSettings).get(), hasLength(1));

    await repository.saveProxyUrl(null);
    expect(await repository.loadProxyUrl(), isNull);
  });

  test('deduplicates entries by feed and guid', () async {
    final item = _entry('guid-1', 'First');

    expect(await repository.insertParsedEntries('feed-1', [item]), 1);
    expect(await repository.insertParsedEntries('feed-1', [item]), 0);

    final entries = await database.select(database.entries).get();
    expect(entries, hasLength(1));
  });

  test('paginates inbox with a stable cursor', () async {
    await repository.insertParsedEntries('feed-1', [
      _entry('guid-1', 'Newest', day: 3),
      _entry('guid-2', 'Middle', day: 2),
      _entry('guid-3', 'Oldest', day: 1),
    ]);

    final first = await repository.listInbox(limit: 2);
    final second = await repository.listInbox(
      cursor: first.nextCursor,
      limit: 2,
    );

    expect(first.entries.map((entry) => entry.title), ['Newest', 'Middle']);
    expect(second.entries.map((entry) => entry.title), ['Oldest']);
    expect(second.nextCursor, isNull);
  });

  test('updates read, starred and tag state transactionally', () async {
    await repository.insertParsedEntries('feed-1', [
      _entry('state-1', 'State'),
    ]);
    final entry = await database.select(database.entries).getSingle();
    final now = DateTime.now().toUtc();
    await database
        .into(database.userTags)
        .insert(
          UserTagsCompanion.insert(
            id: 'tag-1',
            name: 'mobile',
            createdAt: now,
            updatedAt: now,
          ),
        );

    await repository.markRead(entry.id, read: true);
    await repository.setStarred(entry.id, starred: true);
    await repository.assignTag(entryId: entry.id, tagId: 'tag-1');

    final updated = await (database.select(
      database.entries,
    )..where((row) => row.id.equals(entry.id))).getSingle();
    expect(updated.readAt, isNotNull);
    expect(updated.starred, isTrue);
    expect(await database.select(database.entryTags).get(), hasLength(1));

    await repository.markRead(entry.id, read: false);
    final unread = await (database.select(
      database.entries,
    )..where((row) => row.id.equals(entry.id))).getSingle();
    expect(unread.readAt, isNull);
  });

  test('searches title and content through FTS5', () async {
    await repository.insertParsedEntries('feed-1', [
      _entry('search-1', 'Flutter architecture', content: 'local first'),
      _entry('search-2', 'Unrelated', content: 'background refresh'),
    ]);

    final titleResults = await repository.search('Flutter');
    final contentResults = await repository.search('background refresh');

    expect(titleResults.single.title, 'Flutter architecture');
    expect(contentResults.single.title, 'Unrelated');
  });

  test('deleting a feed cascades through all entry relations', () async {
    await repository.insertParsedEntries('feed-1', [
      _entry('cascade-1', 'Cascade'),
    ]);
    final entry = await database.select(database.entries).getSingle();
    final now = DateTime.now().toUtc();

    await database
        .into(database.summaries)
        .insert(
          SummariesCompanion.insert(
            id: 'summary-1',
            entryId: entry.id,
            language: 'zh-CN',
            summary: 'summary',
            createdAt: now,
          ),
        );
    await database
        .into(database.userTags)
        .insert(
          UserTagsCompanion.insert(
            id: 'tag-1',
            name: 'tag',
            createdAt: now,
            updatedAt: now,
          ),
        );
    await repository.assignTag(entryId: entry.id, tagId: 'tag-1');
    await database
        .into(database.collections)
        .insert(
          CollectionsCompanion.insert(
            id: 'collection-1',
            name: 'Saved',
            createdAt: now,
            updatedAt: now,
          ),
        );
    await database
        .into(database.collectionEntries)
        .insert(
          CollectionEntriesCompanion.insert(
            collectionId: 'collection-1',
            entryId: entry.id,
            addedAt: now,
          ),
        );

    await repository.deleteFeed('feed-1');

    expect(await database.select(database.entries).get(), isEmpty);
    expect(await database.select(database.summaries).get(), isEmpty);
    expect(await database.select(database.entryTags).get(), isEmpty);
    expect(await database.select(database.collectionEntries).get(), isEmpty);
    expect(await database.select(database.userTags).get(), hasLength(1));
    expect(await database.select(database.collections).get(), hasLength(1));
  });
}

ParsedEntry _entry(
  String guid,
  String title, {
  int day = 1,
  String content = 'body',
}) {
  return ParsedEntry(
    guid: guid,
    title: title,
    contentHtml: content,
    publishedAt: DateTime.utc(2026, 9, day),
  );
}
