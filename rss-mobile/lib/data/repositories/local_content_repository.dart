import 'package:drift/drift.dart';

import '../../domain/entities/feed.dart' as domain;
import '../../domain/feed_parsing/parsed_feed.dart';
import '../database/local_database.dart';

final class InboxCursor {
  const InboxCursor({required this.timestamp, required this.id});

  final DateTime timestamp;
  final String id;
}

final class InboxPage {
  const InboxPage({required this.entries, required this.nextCursor});

  final List<EntryRow> entries;
  final InboxCursor? nextCursor;
}

final class LocalContentRepository {
  const LocalContentRepository(this.database);

  final LocalDatabase database;

  Future<void> saveFeed(domain.Feed feed) async {
    final now = DateTime.now().toUtc();
    await database
        .into(database.feeds)
        .insertOnConflictUpdate(
          FeedsCompanion.insert(
            id: feed.id,
            url: feed.url.toString(),
            title: feed.title,
            groupName: Value(feed.groupName),
            viewType: Value(feed.viewType.name),
            updateIntervalMinutes: Value(feed.updateInterval.inMinutes),
            createdAt: now,
            updatedAt: now,
          ),
        );
  }

  Future<List<FeedRow>> listFeeds() {
    return (database.select(database.feeds)..orderBy([
          (feed) => OrderingTerm.asc(feed.groupName),
          (feed) => OrderingTerm.asc(feed.title),
        ]))
        .get();
  }

  /// Inserts normalized entries and ignores duplicates by feed + guid.
  Future<int> insertParsedEntries(String feedId, Iterable<ParsedEntry> items) {
    return database.transaction(() async {
      var inserted = 0;
      final now = DateTime.now().toUtc();
      for (final item in items) {
        final result = await database
            .into(database.entries)
            .insertReturningOrNull(
              EntriesCompanion.insert(
                id: _entryId(feedId, item.guid),
                feedId: feedId,
                guid: item.guid,
                title: Value(item.title),
                url: Value(item.link?.toString()),
                author: Value(item.author),
                summary: Value(item.summaryHtml),
                content: Value(item.contentHtml),
                categoriesJson: Value(
                  item.categories.isEmpty ? null : _jsonArray(item.categories),
                ),
                publishedAt: Value(item.publishedAt),
                insertedAt: now,
                enclosureUrl: Value(
                  item.enclosure.isEmpty
                      ? null
                      : item.enclosure.first.url.toString(),
                ),
                enclosureType: Value(
                  item.enclosure.isEmpty ? null : item.enclosure.first.type,
                ),
                enclosureLength: Value(
                  item.enclosure.isEmpty
                      ? null
                      : item.enclosure.first.lengthInBytes,
                ),
                durationSeconds: Value(item.duration?.inSeconds),
                imageUrl: Value(
                  item.imageUrls.isEmpty ? null : item.imageUrls.first,
                ),
                doi: Value(item.doi),
                pmid: Value(item.pmid),
              ),
              mode: InsertMode.insertOrIgnore,
            );
        if (result != null) inserted++;
      }
      return inserted;
    });
  }

  Future<InboxPage> listInbox({
    InboxCursor? cursor,
    bool unreadOnly = false,
    int limit = 50,
  }) async {
    final where = <String>[];
    final variables = <Variable<Object>>[];

    if (unreadOnly) where.add('read_at IS NULL');
    if (cursor != null) {
      where.add(
        '(COALESCE(published_at, inserted_at) < ? OR '
        '(COALESCE(published_at, inserted_at) = ? AND id < ?))',
      );
      variables
        ..add(Variable<DateTime>(cursor.timestamp))
        ..add(Variable<DateTime>(cursor.timestamp))
        ..add(Variable<String>(cursor.id));
    }
    variables.add(Variable<int>(limit));

    final rows = await database
        .customSelect(
          'SELECT * FROM entries '
          '${where.isEmpty ? '' : 'WHERE ${where.join(' AND ')} '} '
          'ORDER BY COALESCE(published_at, inserted_at) DESC, id DESC '
          'LIMIT ?',
          variables: variables,
          readsFrom: {database.entries},
        )
        .get();

    final entries = rows.map((row) => database.entries.map(row.data)).toList();
    final last = entries.lastOrNull;
    return InboxPage(
      entries: entries,
      nextCursor: last == null || entries.length < limit
          ? null
          : InboxCursor(
              timestamp: last.publishedAt ?? last.insertedAt,
              id: last.id,
            ),
    );
  }

  Future<void> markRead(String entryId, {required bool read}) {
    return database.transaction(() async {
      await (database.update(
        database.entries,
      )..where((entry) => entry.id.equals(entryId))).write(
        EntriesCompanion(readAt: Value(read ? DateTime.now().toUtc() : null)),
      );
    });
  }

  Future<void> setStarred(String entryId, {required bool starred}) {
    return (database.update(database.entries)
          ..where((entry) => entry.id.equals(entryId)))
        .write(EntriesCompanion(starred: Value(starred)));
  }

  Future<void> assignTag({required String entryId, required String tagId}) {
    return database.transaction(() async {
      final now = DateTime.now().toUtc();
      await database
          .into(database.entryTags)
          .insert(
            EntryTagsCompanion.insert(
              entryId: entryId,
              tagId: tagId,
              isManual: const Value(true),
              createdAt: now,
            ),
            mode: InsertMode.insertOrIgnore,
          );
    });
  }

  Future<List<EntryRow>> search(String query, {int limit = 50}) async {
    final normalized = query.trim();
    if (normalized.isEmpty) return const [];
    final ftsQuery = '"${normalized.replaceAll('"', '""')}"';
    final rows = await database
        .customSelect(
          'SELECT entries.* FROM entries_fts '
          'JOIN entries ON entries.rowid = entries_fts.rowid '
          'WHERE entries_fts MATCH ? '
          'ORDER BY rank LIMIT ?',
          variables: [Variable<String>(ftsQuery), Variable<int>(limit)],
          readsFrom: {database.entries},
        )
        .get();
    return rows.map((row) => database.entries.map(row.data)).toList();
  }

  Future<void> deleteFeed(String feedId) async {
    await (database.delete(
      database.feeds,
    )..where((feed) => feed.id.equals(feedId))).go();
  }
}

String _entryId(String feedId, String guid) {
  var hash = 0x811c9dc5;
  for (final unit in '$feedId\u0000$guid'.codeUnits) {
    hash ^= unit;
    hash = (hash * 0x01000193) & 0xFFFFFFFF;
  }
  return 'entry-${hash.toRadixString(16).padLeft(8, '0')}';
}

String _jsonArray(List<String> values) {
  return '[${values.map((value) => '"${_jsonEscape(value)}"').join(',')}]';
}

String _jsonEscape(String value) => value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r');
