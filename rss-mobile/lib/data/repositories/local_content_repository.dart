import 'package:drift/drift.dart';

import '../../domain/entities/entry.dart' as domain_entry;
import '../../domain/entities/feed.dart' as domain_feed;
import '../../domain/value_objects/feed_view_type.dart' as domain_type;
import '../../domain/feed_parsing/parsed_feed.dart';
import '../database/local_database.dart';

final class InboxCursor {
  const InboxCursor({required this.timestamp, required this.id});

  final DateTime timestamp;
  final String id;
}

final class InboxPage {
  const InboxPage({required this.entries, required this.nextCursor});

  final List<domain_entry.Entry> entries;
  final InboxCursor? nextCursor;
}

final class GroupSummary {
  const GroupSummary({
    required this.name,
    required this.feedCount,
    required this.unreadEntries,
  });

  final String name;
  final int feedCount;
  final int unreadEntries;
}

final class LocalContentRepository {
  const LocalContentRepository(this.database);

  final LocalDatabase database;

  Future<void> saveFeed(domain_feed.Feed feed) async {
    final now = DateTime.now().toUtc();
    final existing = await (database.select(
      database.feeds,
    )..where((row) => row.id.equals(feed.id))).getSingleOrNull();
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
            lastCheckedAt: Value(now),
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          ),
        );
  }

  Future<List<domain_feed.Feed>> listFeeds() async {
    final rows =
        await (database.select(database.feeds)..orderBy([
              (feed) => OrderingTerm.asc(feed.groupName),
              (feed) => OrderingTerm.asc(feed.title),
            ]))
            .get();
    return rows.map(_feedFromRow).toList();
  }

  Future<({String baseUrl, String model})> loadAiConfig() async {
    final settings = await database
        .select(database.userSettings)
        .getSingleOrNull();
    if (settings == null) return (baseUrl: '', model: '');
    return (baseUrl: settings.aiBaseUrl, model: settings.aiModel);
  }

  Future<void> saveAiConfig({
    required String baseUrl,
    required String model,
  }) async {
    final now = DateTime.now().toUtc();
    final existing = await database
        .select(database.userSettings)
        .getSingleOrNull();
    if (existing == null) {
      await database
          .into(database.userSettings)
          .insert(
            UserSettingsCompanion.insert(
              aiBaseUrl: Value(baseUrl),
              aiModel: Value(model),
              createdAt: now,
              updatedAt: now,
            ),
          );
      return;
    }
    await (database.update(
      database.userSettings,
    )..where((row) => row.id.equals(existing.id))).write(
      UserSettingsCompanion(
        aiBaseUrl: Value(baseUrl),
        aiModel: Value(model),
        updatedAt: Value(now),
      ),
    );
  }

  Future<String?> loadProxyUrl() async {
    final settings = await database
        .select(database.userSettings)
        .getSingleOrNull();
    if (settings != null) return settings.proxyUrl;

    final now = DateTime.now().toUtc();
    await database
        .into(database.userSettings)
        .insert(UserSettingsCompanion.insert(createdAt: now, updatedAt: now));
    return null;
  }

  Future<void> saveProxyUrl(String? proxyUrl) async {
    final now = DateTime.now().toUtc();
    final existing = await database
        .select(database.userSettings)
        .getSingleOrNull();
    if (existing == null) {
      await database
          .into(database.userSettings)
          .insert(
            UserSettingsCompanion.insert(
              proxyUrl: Value(proxyUrl),
              createdAt: now,
              updatedAt: now,
            ),
          );
      return;
    }

    await (database.update(
      database.userSettings,
    )..where((row) => row.id.equals(existing.id))).write(
      UserSettingsCompanion(proxyUrl: Value(proxyUrl), updatedAt: Value(now)),
    );
  }

  /// Aggregated feed-group statistics, sorted by name with the default
  /// group last so it reads as "everything else".
  Future<List<GroupSummary>> listGroups() async {
    final rows = await database
        .customSelect(
          'SELECT f.group_name AS name, '
          'COUNT(DISTINCT f.id) AS feed_count, '
          'SUM(CASE WHEN e.read_at IS NULL THEN 1 ELSE 0 END) AS unread '
          'FROM feeds f '
          'LEFT JOIN entries e ON e.feed_id = f.id '
          'GROUP BY f.group_name '
          'ORDER BY CASE WHEN f.group_name = \'default\' THEN 1 ELSE 0 END, name',
          readsFrom: {database.feeds, database.entries},
        )
        .get();
    return rows
        .map(
          (row) => GroupSummary(
            name: row.read<String>('name'),
            feedCount: row.read<int>('feed_count'),
            unreadEntries: row.read<int?>('unread') ?? 0,
          ),
        )
        .toList();
  }

  Future<void> setFeedGroup(String feedId, String groupName) async {
    await (database.update(
      database.feeds,
    )..where((feed) => feed.id.equals(feedId))).write(
      FeedsCompanion(
        groupName: Value(groupName),
        updatedAt: Value(DateTime.now().toUtc()),
      ),
    );
  }

  /// Renames a group; returns the number of feeds moved.
  Future<int> renameGroup(String oldName, String newName) async {
    if (oldName == newName) return 0;
    final result =
        await (database.update(
          database.feeds,
        )..where((feed) => feed.groupName.equals(oldName))).write(
          FeedsCompanion(
            groupName: Value(newName),
            updatedAt: Value(DateTime.now().toUtc()),
          ),
        );
    return result;
  }

  /// Dissolves a group by moving its feeds to the default group.
  Future<int> deleteGroup(String groupName) async {
    if (groupName == 'default') return 0;
    return renameGroup(groupName, 'default');
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
    Set<String> excludeGroups = const {},
    int limit = 50,
  }) async {
    final where = <String>[];
    final variables = <Variable<Object>>[];

    if (unreadOnly) where.add('entries.read_at IS NULL');
    if (excludeGroups.isNotEmpty) {
      final placeholders = List.filled(excludeGroups.length, '?').join(', ');
      where.add(
        'entries.feed_id NOT IN '
        '(SELECT id FROM feeds WHERE group_name IN ($placeholders))',
      );
      variables.addAll(excludeGroups.map(Variable<String>.new));
    }
    if (cursor != null) {
      where.add(
        '(COALESCE(entries.published_at, entries.inserted_at) < ? OR '
        '(COALESCE(entries.published_at, entries.inserted_at) = ? AND entries.id < ?))',
      );
      variables
        ..add(Variable<DateTime>(cursor.timestamp))
        ..add(Variable<DateTime>(cursor.timestamp))
        ..add(Variable<String>(cursor.id));
    }
    variables.add(Variable<int>(limit));

    final rows = await database
        .customSelect(
          'SELECT entries.*, t.title AS translated_title '
          'FROM entries '
          'LEFT JOIN translations t '
          "ON t.entry_id = entries.id AND t.language = 'zh' "
          '${where.isEmpty ? '' : 'WHERE ${where.join(' AND ')} '} '
          'ORDER BY COALESCE(entries.published_at, entries.inserted_at) DESC, entries.id DESC '
          'LIMIT ?',
          variables: variables,
          readsFrom: {database.entries, database.translations},
        )
        .get();

    final entries = rows.map((row) {
      final entry = _entryFromRow(database.entries.map(row.data));
      final translated = row.data.containsKey('translated_title')
          ? row.data['translated_title'] as String?
          : null;
      return translated != null && translated.isNotEmpty
          ? entry.copyWith(translatedTitle: translated)
          : entry;
    }).toList();
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

  /// Marks every unread entry (optionally limited to a group) as read.
  /// Returns the number of entries updated.
  Future<int> markInboxRead({String? groupName}) async {
    var query = database.update(database.entries)
      ..where((entry) => entry.readAt.isNull());
    if (groupName != null) {
      final groupFeedIds = database.selectOnly(database.feeds)
        ..addColumns([database.feeds.id])
        ..where(database.feeds.groupName.equals(groupName));
      query = query..where((entry) => entry.feedId.isInQuery(groupFeedIds));
    }
    return query.write(EntriesCompanion(readAt: Value(DateTime.now().toUtc())));
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

  Future<void> markExtractionRunning(String entryId) {
    return (database.update(
      database.entries,
    )..where((entry) => entry.id.equals(entryId))).write(
      const EntriesCompanion(
        contentExtractionStatus: Value('running'),
        contentExtractionError: Value(null),
      ),
    );
  }

  Future<void> saveExtractedContent({
    required String entryId,
    required String contentHtml,
    required Uri sourceUrl,
  }) {
    return (database.update(
      database.entries,
    )..where((entry) => entry.id.equals(entryId))).write(
      EntriesCompanion(
        readabilityContent: Value(contentHtml),
        contentSourceUrl: Value(sourceUrl.toString()),
        contentExtractedAt: Value(DateTime.now().toUtc()),
        contentExtractionStatus: const Value('succeeded'),
        contentExtractionError: const Value(null),
      ),
    );
  }

  /// Caches an AI summary for the given entry and language.
  Future<void> saveSummary({
    required String entryId,
    required String language,
    required String summary,
  }) async {
    final now = DateTime.now().toUtc();
    await database
        .into(database.summaries)
        .insertOnConflictUpdate(
          SummariesCompanion.insert(
            id: 'summary-$entryId-$language',
            entryId: entryId,
            language: language,
            summary: summary,
            createdAt: now,
          ),
        );
  }

  Future<String?> loadSummary({
    required String entryId,
    required String language,
  }) async {
    final row =
        await (database.select(database.summaries)
              ..where((s) => s.entryId.equals(entryId))
              ..where((s) => s.language.equals(language)))
            .getSingleOrNull();
    return row?.summary;
  }

  /// Caches a translation for the given entry and language.
  Future<void> saveTranslation({
    required String entryId,
    required String language,
    required String title,
    String? summary,
  }) async {
    final now = DateTime.now().toUtc();
    await database
        .into(database.translations)
        .insertOnConflictUpdate(
          TranslationsCompanion.insert(
            id: 'translation-$entryId-$language',
            entryId: entryId,
            language: language,
            title: Value(title),
            summary: Value(summary),
            createdAt: now,
          ),
        );
  }

  Future<({String title, String? summary})?> loadTranslation({
    required String entryId,
    required String language,
  }) async {
    final row =
        await (database.select(database.translations)
              ..where((t) => t.entryId.equals(entryId))
              ..where((t) => t.language.equals(language)))
            .getSingleOrNull();
    if (row == null) return null;
    return (title: row.title ?? '', summary: row.summary);
  }

  Future<void> saveExtractionFailure(String entryId, String error) {
    return (database.update(
      database.entries,
    )..where((entry) => entry.id.equals(entryId))).write(
      EntriesCompanion(
        contentExtractionStatus: const Value('failed'),
        contentExtractionError: Value(error),
      ),
    );
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

  Future<List<domain_entry.Entry>> listStarred({int limit = 100}) async {
    final rows =
        await (database.select(database.entries)
              ..where((entry) => entry.starred.equals(true))
              ..orderBy([
                (entry) => OrderingTerm.desc(entry.publishedAt),
                (entry) => OrderingTerm.desc(entry.insertedAt),
              ])
              ..limit(limit))
            .get();
    return rows.map(_entryFromRow).toList();
  }

  Future<List<domain_entry.Entry>> search(
    String query, {
    int limit = 50,
  }) async {
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
    return rows
        .map((row) => _entryFromRow(database.entries.map(row.data)))
        .toList();
  }

  Future<void> deleteFeed(String feedId) async {
    await (database.delete(
      database.feeds,
    )..where((feed) => feed.id.equals(feedId))).go();
  }
}

domain_feed.Feed _feedFromRow(FeedRow row) {
  return domain_feed.Feed(
    id: row.id,
    title: row.title,
    url: Uri.parse(row.url),
    groupName: row.groupName,
    viewType: _feedViewType(row.viewType),
    updateInterval: Duration(minutes: row.updateIntervalMinutes),
  );
}

domain_entry.Entry _entryFromRow(EntryRow row) {
  return domain_entry.Entry(
    id: row.id,
    feedId: row.feedId,
    guid: row.guid,
    title: row.title ?? '(untitled)',
    url: row.url == null ? null : Uri.tryParse(row.url!),
    author: row.author,
    summary: row.summary,
    content: row.content,
    readabilityContent: row.readabilityContent,
    contentSourceUrl: row.contentSourceUrl == null
        ? null
        : Uri.tryParse(row.contentSourceUrl!),
    contentExtractedAt: row.contentExtractedAt,
    contentExtractionStatus: _extractionStatus(row.contentExtractionStatus),
    contentExtractionError: row.contentExtractionError,
    imageUrl: row.imageUrl == null ? null : Uri.tryParse(row.imageUrl!),
    enclosureUrl: row.enclosureUrl == null
        ? null
        : Uri.tryParse(row.enclosureUrl!),
    enclosureType: row.enclosureType,
    enclosureDuration: row.durationSeconds == null
        ? null
        : Duration(seconds: row.durationSeconds!),
    publishedAt: row.publishedAt,
    insertedAt: row.insertedAt,
    readAt: row.readAt,
    isStarred: row.starred,
  );
}

domain_entry.ContentExtractionStatus _extractionStatus(String value) {
  return domain_entry.ContentExtractionStatus.values.firstWhere(
    (status) => status.name == value,
    orElse: () => domain_entry.ContentExtractionStatus.idle,
  );
}

// Keep unknown future values readable instead of failing an old client.
domain_type.FeedViewType _feedViewType(String value) {
  return domain_type.FeedViewType.values.firstWhere(
    (type) => type.name == value,
    orElse: () => domain_type.FeedViewType.articles,
  );
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
