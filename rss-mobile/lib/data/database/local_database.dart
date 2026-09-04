import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqlite3/sqlite3.dart' as sqlite;

part 'local_database.g.dart';

@DataClassName('FeedRow')
class Feeds extends Table {
  TextColumn get id => text()();
  TextColumn get url => text().unique()();
  TextColumn get title => text()();
  TextColumn get customTitle => text().nullable()();
  TextColumn get siteUrl => text().nullable()();
  TextColumn get description => text().nullable()();
  TextColumn get groupName => text().withDefault(const Constant('default'))();
  TextColumn get viewType => text().withDefault(const Constant('articles'))();
  IntColumn get updateIntervalMinutes =>
      integer().withDefault(const Constant(720))();
  TextColumn get fetchEtag => text().nullable()();
  TextColumn get fetchLastModified => text().nullable()();
  DateTimeColumn get lastCheckedAt => dateTime().nullable()();
  TextColumn get lastError => text().nullable()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

@DataClassName('EntryRow')
class Entries extends Table {
  TextColumn get id => text()();
  TextColumn get feedId =>
      text().references(Feeds, #id, onDelete: KeyAction.cascade)();
  TextColumn get guid => text()();
  TextColumn get title => text().nullable()();
  TextColumn get url => text().nullable()();
  TextColumn get author => text().nullable()();
  TextColumn get summary => text().nullable()();
  TextColumn get content => text().nullable()();
  TextColumn get readabilityContent => text().nullable()();
  TextColumn get contentSourceUrl => text().nullable()();
  DateTimeColumn get contentExtractedAt => dateTime().nullable()();
  TextColumn get contentExtractionStatus =>
      text().withDefault(const Constant('idle'))();
  TextColumn get contentExtractionError => text().nullable()();
  TextColumn get categoriesJson => text().nullable()();
  DateTimeColumn get publishedAt => dateTime().nullable()();
  DateTimeColumn get insertedAt => dateTime()();
  DateTimeColumn get readAt => dateTime().nullable()();
  BoolColumn get starred => boolean().withDefault(const Constant(false))();
  TextColumn get enclosureUrl => text().nullable()();
  TextColumn get enclosureType => text().nullable()();
  IntColumn get enclosureLength => integer().nullable()();
  IntColumn get durationSeconds => integer().nullable()();
  TextColumn get imageUrl => text().nullable()();
  TextColumn get doi => text().nullable()();
  TextColumn get pmid => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {id};

  @override
  List<Set<Column<Object>>> get uniqueKeys => [
    {feedId, guid},
  ];
}

@DataClassName('SummaryRow')
class Summaries extends Table {
  TextColumn get id => text()();
  TextColumn get entryId =>
      text().references(Entries, #id, onDelete: KeyAction.cascade)();
  TextColumn get language => text()();
  TextColumn get summary => text()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};

  @override
  List<Set<Column<Object>>> get uniqueKeys => [
    {entryId, language},
  ];
}

@DataClassName('TranslationRow')
class Translations extends Table {
  TextColumn get id => text()();
  TextColumn get entryId =>
      text().references(Entries, #id, onDelete: KeyAction.cascade)();
  TextColumn get language => text()();
  TextColumn get title => text().nullable()();
  TextColumn get summary => text().nullable()();
  TextColumn get content => text().nullable()();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};

  @override
  List<Set<Column<Object>>> get uniqueKeys => [
    {entryId, language},
  ];
}

@DataClassName('UserSettingsRow')
class UserSettings extends Table {
  IntColumn get id => integer().withDefault(const Constant(1))();
  TextColumn get language => text().withDefault(const Constant('zh-CN'))();
  BoolColumn get autoRefresh => boolean().withDefault(const Constant(false))();
  IntColumn get refreshIntervalMinutes =>
      integer().withDefault(const Constant(720))();
  TextColumn get aiBaseUrl => text().withDefault(const Constant(''))();
  TextColumn get aiModel => text().withDefault(const Constant(''))();
  TextColumn get proxyUrl => text().nullable()();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

@DataClassName('UserTagRow')
class UserTags extends Table {
  TextColumn get id => text()();
  TextColumn get name => text().unique()();
  TextColumn get color => text().withDefault(const Constant('#3b82f6'))();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

@DataClassName('EntryTagRow')
class EntryTags extends Table {
  TextColumn get entryId =>
      text().references(Entries, #id, onDelete: KeyAction.cascade)();
  TextColumn get tagId =>
      text().references(UserTags, #id, onDelete: KeyAction.cascade)();
  BoolColumn get isManual => boolean().withDefault(const Constant(false))();
  DateTimeColumn get createdAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {entryId, tagId};
}

@DataClassName('CollectionRow')
class Collections extends Table {
  TextColumn get id => text()();
  TextColumn get name => text()();
  TextColumn get icon => text().withDefault(const Constant('folder'))();
  TextColumn get color => text().withDefault(const Constant('#ff7a18'))();
  IntColumn get sortOrder => integer().withDefault(const Constant(0))();
  DateTimeColumn get createdAt => dateTime()();
  DateTimeColumn get updatedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

@DataClassName('CollectionEntryRow')
class CollectionEntries extends Table {
  TextColumn get collectionId =>
      text().references(Collections, #id, onDelete: KeyAction.cascade)();
  TextColumn get entryId =>
      text().references(Entries, #id, onDelete: KeyAction.cascade)();
  TextColumn get note => text().nullable()();
  DateTimeColumn get addedAt => dateTime()();

  @override
  Set<Column<Object>> get primaryKey => {collectionId, entryId};
}

@DriftDatabase(
  tables: [
    Feeds,
    Entries,
    Summaries,
    Translations,
    UserSettings,
    UserTags,
    EntryTags,
    Collections,
    CollectionEntries,
  ],
)
final class LocalDatabase extends _$LocalDatabase {
  LocalDatabase(super.executor);

  factory LocalDatabase.memory() => LocalDatabase(
    DatabaseConnection(
      NativeDatabase.memory(),
      closeStreamsSynchronously: true,
    ),
  );

  factory LocalDatabase.onDevice() => LocalDatabase(_openOnDevice());

  @override
  int get schemaVersion => 3;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (migrator) async {
      await migrator.createAll();
    },
    onUpgrade: (migrator, from, to) async {
      if (from < 2) {
        await migrator.addColumn(userSettings, userSettings.proxyUrl);
      }
      if (from < 3) {
        await migrator.addColumn(entries, entries.readabilityContent);
        await migrator.addColumn(entries, entries.contentSourceUrl);
        await migrator.addColumn(entries, entries.contentExtractedAt);
        await migrator.addColumn(entries, entries.contentExtractionStatus);
        await migrator.addColumn(entries, entries.contentExtractionError);
        await customStatement('DROP TRIGGER IF EXISTS entries_fts_ai');
        await customStatement('DROP TRIGGER IF EXISTS entries_fts_ad');
        await customStatement('DROP TRIGGER IF EXISTS entries_fts_au');
        await customStatement('DROP TABLE IF EXISTS entries_fts');
      }
    },
    beforeOpen: (details) async {
      await customStatement('PRAGMA foreign_keys = ON');
      await customStatement('PRAGMA journal_mode = WAL');
      await customStatement(
        'CREATE INDEX IF NOT EXISTS entries_feed_time '
        'ON entries(feed_id, published_at DESC, inserted_at DESC)',
      );
      await customStatement(
        'CREATE INDEX IF NOT EXISTS entries_inbox_time '
        'ON entries(published_at DESC, inserted_at DESC)',
      );
      await customStatement(
        'CREATE INDEX IF NOT EXISTS entries_read_time '
        'ON entries(read_at, published_at DESC)',
      );
      await customStatement('''
        CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
          title,
          summary,
          content,
          readability_content,
          content='entries',
          content_rowid='rowid'
        )
      ''');
      await customStatement('''
        CREATE TRIGGER IF NOT EXISTS entries_fts_ai AFTER INSERT ON entries BEGIN
          INSERT INTO entries_fts(rowid, title, summary, content, readability_content)
          VALUES (new.rowid, new.title, new.summary, new.content, new.readability_content);
        END
      ''');
      await customStatement('''
        CREATE TRIGGER IF NOT EXISTS entries_fts_ad AFTER DELETE ON entries BEGIN
          INSERT INTO entries_fts(entries_fts, rowid, title, summary, content, readability_content)
          VALUES ('delete', old.rowid, old.title, old.summary, old.content, old.readability_content);
        END
      ''');
      await customStatement('''
        CREATE TRIGGER IF NOT EXISTS entries_fts_au AFTER UPDATE ON entries BEGIN
          INSERT INTO entries_fts(entries_fts, rowid, title, summary, content, readability_content)
          VALUES ('delete', old.rowid, old.title, old.summary, old.content, old.readability_content);
          INSERT INTO entries_fts(rowid, title, summary, content, readability_content)
          VALUES (new.rowid, new.title, new.summary, new.content, new.readability_content);
        END
      ''');
      if (details.wasCreated || details.hadUpgrade) {
        await customStatement(
          "INSERT INTO entries_fts(entries_fts) VALUES ('rebuild')",
        );
      }
    },
  );
}

LazyDatabase _openOnDevice() {
  return LazyDatabase(() async {
    final supportDir = await getApplicationSupportDirectory();
    final tempDir = await getTemporaryDirectory();
    sqlite.sqlite3.tempDirectory = tempDir.path;
    final file = File(p.join(supportDir.path, 'aurora-mobile.sqlite'));
    return NativeDatabase.createInBackground(file);
  });
}
