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
    expect(version.read<int>('user_version'), 3);
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

  test('listInbox excludes muted groups via excludeGroups', () async {
    await repository.saveFeed(
      Feed(
        id: 'feed-2',
        title: 'Grouped Feed',
        url: Uri.parse('https://example.com/grouped.xml'),
        groupName: '技术',
      ),
    );
    await repository.insertParsedEntries('feed-1', [_entry('ex-1', 'A')]);
    await repository.insertParsedEntries('feed-2', [_entry('ex-2', 'B')]);

    final visible = await repository.listInbox(excludeGroups: const {'技术'});
    expect(visible.entries, hasLength(1));
    expect(visible.entries.single.feedId, 'feed-1');
  });

  test('marks inbox entries as read, optionally per group', () async {
    await repository.saveFeed(
      Feed(
        id: 'feed-2',
        title: 'Grouped Feed',
        url: Uri.parse('https://example.com/grouped.xml'),
        groupName: '技术',
      ),
    );
    await repository.insertParsedEntries('feed-1', [_entry('mr-1', 'A')]);
    await repository.insertParsedEntries('feed-2', [_entry('mr-2', 'B')]);

    final updated = await repository.markInboxRead(groupName: '技术');
    expect(updated, 1);

    final statuses = await database
        .customSelect(
          'SELECT e.read_at IS NULL AS unread, f.group_name AS group_name '
          'FROM entries e JOIN feeds f ON f.id = e.feed_id',
        )
        .get();
    expect(
      statuses.where((row) => row.read<String>('group_name') == '技术').length,
      1,
    );

    // Re-reading through drift must succeed (catches storage-format drift).
    final reread = await repository.listInbox();
    expect(reread.entries, hasLength(2));
    expect(
      reread.entries.singleWhere((entry) => entry.guid == 'mr-2').isRead,
      isTrue,
    );
    expect(
      reread.entries.singleWhere((entry) => entry.guid == 'mr-1').isRead,
      isFalse,
    );
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

  test(
    'groups aggregate statistics and support move, rename, delete',
    () async {
      await repository.saveFeed(
        Feed(
          id: 'feed-2',
          title: 'Grouped Feed',
          url: Uri.parse('https://example.com/grouped.xml'),
          groupName: '技术',
        ),
      );
      await repository.insertParsedEntries('feed-1', [_entry('g-1', 'A')]);
      await repository.insertParsedEntries('feed-2', [
        _entry('g-2', 'B', content: 'grouped'),
        _entry('g-3', 'C'),
      ]);

      var groups = await repository.listGroups();
      expect(groups.map((group) => group.name), containsAll(['default', '技术']));
      final tech = groups.singleWhere((group) => group.name == '技术');
      expect(tech.feedCount, 1);
      expect(tech.unreadEntries, 2);

      // Move a feed into the group; the now-empty default group disappears
      // because groups are implicit from feeds.
      await repository.setFeedGroup('feed-1', '技术');
      groups = await repository.listGroups();
      expect(groups.singleWhere((group) => group.name == '技术').feedCount, 2);
      expect(groups.any((group) => group.name == 'default'), isFalse);

      // Rename keeps all feeds.
      await repository.renameGroup('技术', '阅读');
      groups = await repository.listGroups();
      expect(groups.any((group) => group.name == '技术'), isFalse);
      expect(groups.singleWhere((group) => group.name == '阅读').feedCount, 2);

      // Inbox can be filtered by excluding other groups (feed-1 moved in,
      // so 1+2 entries).
      final techInbox = await repository.listInbox(
        excludeGroups: const {'default'},
      );
      expect(techInbox.entries, hasLength(3));

      // Deleting a group moves feeds back to default.
      await repository.deleteGroup('阅读');
      groups = await repository.listGroups();
      expect(groups.any((group) => group.name == '阅读'), isFalse);
      expect(
        groups.singleWhere((group) => group.name == 'default').feedCount,
        2,
      );
    },
  );

  test('caches extracted content and adds it to FTS5', () async {
    await repository.insertParsedEntries('feed-1', [
      _entry('extract-1', 'Original title', content: 'feed excerpt'),
    ]);
    final entry = await database.select(database.entries).getSingle();

    await repository.markExtractionRunning(entry.id);
    await repository.saveExtractedContent(
      entryId: entry.id,
      contentHtml: '<p>UniqueReadabilityNeedle full article</p>',
      sourceUrl: Uri.parse('https://example.com/full'),
    );

    final updated = await database.select(database.entries).getSingle();
    expect(updated.contentExtractionStatus, 'succeeded');
    expect(updated.readabilityContent, contains('UniqueReadabilityNeedle'));
    expect(updated.contentSourceUrl, 'https://example.com/full');
    expect(updated.contentExtractedAt, isNotNull);
    expect(
      (await repository.search('UniqueReadabilityNeedle')).single.id,
      entry.id,
    );
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
