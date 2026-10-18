import 'package:aurora_mobile/data/database/local_database.dart';
import 'package:aurora_mobile/data/repositories/local_content_repository.dart';
import 'package:aurora_mobile/domain/entities/feed.dart';
import 'package:aurora_mobile/domain/feed_parsing/parsed_feed.dart';
import 'package:aurora_mobile/domain/value_objects/feed_view_type.dart';
import 'package:drift/drift.dart' show Value;
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
    expect(version.read<int>('user_version'), 7);
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

  group('tags', () {
    Future<String> seedEntry(String guid) async {
      await repository.insertParsedEntries('feed-1', [_entry(guid, guid)]);
      final rows = await (database.select(database.entries)
            ..where((row) => row.guid.equals(guid)))
          .get();
      return rows.single.id;
    }

    test('ensureTag creates once and reuses by trimmed, case-insensitive name',
        () async {
      final first = await repository.ensureTag('AI');
      final again = await repository.ensureTag(' ai ');

      expect(again.id, first.id);
      expect(
        await database.select(database.userTags).get(),
        hasLength(1),
      );
      expect(first.color, kTagPalette.first);
    });

    test('ensureTag rotates palette colors across new tags', () async {
      final a = await repository.ensureTag('one');
      final b = await repository.ensureTag('two');

      expect(a.color, isNot(b.color));
    });

    test('listTags counts entries and orders most-used first', () async {
      final entryA = await seedEntry('tagged-a');
      final entryB = await seedEntry('tagged-b');
      final entryC = await seedEntry('tagged-c');
      final popular = await repository.ensureTag('popular');
      final quiet = await repository.ensureTag('quiet');

      await repository.assignTag(entryId: entryA, tagId: popular.id);
      await repository.assignTag(entryId: entryB, tagId: popular.id);
      await repository.assignTag(entryId: entryC, tagId: quiet.id);

      final tags = await repository.listTags();
      expect(tags.map((tag) => tag.name), ['popular', 'quiet']);
      expect(tags.first.entryCount, 2);
      expect(tags.last.entryCount, 1);
    });

    test('setEntryTag toggles associations idempotently', () async {
      final entryId = await seedEntry('toggle-me');
      final tag = await repository.ensureTag('toggle');

      await repository.setEntryTag(
        entryId: entryId,
        tagId: tag.id,
        assigned: true,
      );
      await repository.setEntryTag(
        entryId: entryId,
        tagId: tag.id,
        assigned: true,
      );
      expect(await repository.entryTagIds(entryId), {tag.id});

      await repository.setEntryTag(
        entryId: entryId,
        tagId: tag.id,
        assigned: false,
      );
      expect(await repository.entryTagIds(entryId), isEmpty);
    });

    test('entriesByTag returns newest first with translated titles', () async {
      final older = await seedEntry('older-guid');
      final newer = await seedEntry('newer-guid');
      final tag = await repository.ensureTag('ordered');
      await repository.assignTag(entryId: older, tagId: tag.id);
      await repository.assignTag(entryId: newer, tagId: tag.id);

      final entries = await repository.entriesByTag(tag.id);
      expect(entries.map((entry) => entry.guid), ['newer-guid', 'older-guid']);
    });

    test('renameTag and updateTagColor persist changes', () async {
      final tag = await repository.ensureTag('rename-me');

      await repository.renameTag(tag.id, 'renamed');
      await repository.updateTagColor(tag.id, '#EF4444');

      final tags = await repository.listTags();
      expect(tags.single.name, 'renamed');
      expect(tags.single.color, '#EF4444');
    });

    test('deleteTag drops associations but keeps entries', () async {
      final entryId = await seedEntry('keep-me');
      final tag = await repository.ensureTag('doomed');
      await repository.assignTag(entryId: entryId, tagId: tag.id);

      await repository.deleteTag(tag.id);

      expect(await repository.listTags(), isEmpty);
      expect(await repository.entryTagIds(entryId), isEmpty);
      expect(
        await database.select(database.entries).get(),
        hasLength(1),
      );
    });

    test('insertParsedEntries auto-tags new entries with isManual=false',
        () async {
      await repository.insertParsedEntries(
        'feed-1',
        [_entry('auto-1', 'OpenAI 发布新一代大模型')],
      );

      final tags = await repository.listTags();
      expect(tags.map((tag) => tag.name), contains('AI'));
      final rows = await database.select(database.entries).get();
      final details = await repository.entryTagDetails(rows.single.id);
      expect(details.values, everyElement(isFalse));
    });

    test('manual tags keep isManual=true alongside auto tags', () async {
      final entryId = await seedEntry('mixed-origins');
      final auto = await repository.ensureTag('auto-tag');
      final manual = await repository.ensureTag('manual-tag');

      await repository.setEntryTag(
        entryId: entryId,
        tagId: auto.id,
        assigned: true,
        isManual: false,
      );
      await repository.setEntryTag(
        entryId: entryId,
        tagId: manual.id,
        assigned: true,
      );

      final details = await repository.entryTagDetails(entryId);
      expect(details[auto.id], isFalse);
      expect(details[manual.id], isTrue);
    });

    test('backfillAutoTags re-tags entries that lost their auto tags',
        () async {
      await repository.insertParsedEntries(
        'feed-1',
        [_entry('backfill-1', 'GPT-5 与大模型的新突破')],
      );
      final rows = await database.select(database.entries).get();
      // Simulate a pre-feature article: drop its auto associations.
      await database.delete(database.entryTags).go();
      expect(await repository.entryTagIds(rows.single.id), isEmpty);

      final tagged = await repository.backfillAutoTags();

      expect(tagged, 1);
      final details = await repository.entryTagDetails(rows.single.id);
      expect(details.values, everyElement(isFalse));
      expect(details, isNotEmpty);
    });

    group('filter rules', () {
      Future<void> saveRule(
        String pattern, {
        String action = 'hide',
        String? feedId,
        String matchField = 'title',
        bool isRegex = false,
      }) {
        final now = DateTime.now().toUtc();
        return repository.saveFilterRule(
          FilterRulesCompanion.insert(
            id: 'rule-$pattern-$action',
            pattern: pattern,
            isRegex: Value(isRegex),
            matchField: Value(matchField),
            action: Value(action),
            feedId: Value(feedId),
            createdAt: now,
            updatedAt: now,
          ),
        );
      }

      test('hide rules block insert entirely', () async {
        await saveRule('好物推荐|优惠券');
        final inserted = await repository.insertParsedEntries(
          'feed-1',
          [
            _entry('ad-1', '双11好物推荐'),
            _entry('keep-1', '正常的文章'),
          ],
        );

        expect(inserted, 1);
        final titles = await database.customSelect(
          'SELECT title FROM entries',
        ).get();
        expect(titles.map((r) => r.read<String>('title')), ['正常的文章']);
        // Hit counter recorded the block.
        final rules = await repository.listFilterRules();
        expect(rules.single.hitCount, 1);
      });

      test('markRead and star rules annotate new entries', () async {
        await saveRule('融资', action: 'markRead');
        await saveRule('融资', action: 'star');
        await repository.insertParsedEntries(
          'feed-1',
          [_entry('biz-1', '某公司完成新一轮融资')],
        );

        final row = (await database.select(database.entries).get()).single;
        expect(row.readAt, isNotNull);
        expect(row.starred, isTrue);
      });

      test('feed-scoped rules ignore other feeds', () async {
        await repository.saveFeed(
          Feed(
            id: 'feed-2',
            title: 'Other Feed',
            url: Uri.parse('https://example.com/other.xml'),
            viewType: FeedViewType.articles,
          ),
        );
        await saveRule('广告', feedId: 'feed-2');
        await repository.insertParsedEntries(
          'feed-1',
          [_entry('other-1', '来自其它源的广告')],
        );

        expect(await database.select(database.entries).get(), hasLength(1));
      });

      test('applyFilterRulesToExisting processes stored entries', () async {
        await repository.insertParsedEntries(
          'feed-1',
          [
            _entry('old-ad', '老文章里的好物推荐'),
            _entry('old-ok', '老的正常文章'),
          ],
        );
        await saveRule('好物推荐');

        final affected = await repository.applyFilterRulesToExisting();

        expect(affected, 1);
        final titles = await database.customSelect(
          'SELECT title FROM entries',
        ).get();
        expect(
          titles.map((r) => r.read<String>('title')),
          ['老的正常文章'],
        );
      });

      test('disabled rules are ignored on insert', () async {
        await saveRule('好物推荐');
        await repository.setFilterRuleEnabled('rule-好物推荐-hide', false);
        final inserted = await repository.insertParsedEntries(
          'feed-1',
          [_entry('ad-2', '双11好物推荐')],
        );

        expect(inserted, 1);
      });

      test('deleting a rule stops future filtering', () async {
        await saveRule('好物推荐');
        await repository.deleteFilterRule('rule-好物推荐-hide');
        final inserted = await repository.insertParsedEntries(
          'feed-1',
          [_entry('ad-3', '双11好物推荐')],
        );

        expect(inserted, 1);
      });
    });
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
