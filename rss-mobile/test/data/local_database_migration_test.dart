import 'package:aurora_mobile/data/database/local_database.dart';
import 'package:aurora_mobile/data/repositories/local_content_repository.dart';
import 'package:drift_dev/api/migrations_native.dart';
import 'package:flutter_test/flutter_test.dart';

import '../generated_migrations/schema.dart';

void main() {
  late SchemaVerifier verifier;

  setUpAll(() {
    verifier = SchemaVerifier(GeneratedHelper());
  });

  for (final sourceVersion in [1, 2]) {
    test('migrates schema v$sourceVersion to v3', () async {
      final connection = await verifier.startAt(sourceVersion);
      final database = LocalDatabase(connection);
      addTearDown(database.close);

      await verifier.migrateAndValidate(database, 4);

      final settingsColumns = await database
          .customSelect('PRAGMA table_info(user_settings)')
          .get();
      expect(
        settingsColumns.map((row) => row.read<String>('name')),
        contains('proxy_url'),
      );

      final entryColumns = await database
          .customSelect('PRAGMA table_info(entries)')
          .get();
      expect(
        entryColumns.map((row) => row.read<String>('name')),
        containsAll({
          'readability_content',
          'content_source_url',
          'content_extracted_at',
          'content_extraction_status',
          'content_extraction_error',
        }),
      );

      final ftsColumns = await database
          .customSelect('PRAGMA table_info(entries_fts)')
          .get();
      expect(
        ftsColumns.map((row) => row.read<String>('name')),
        contains('readability_content'),
      );

      final repository = LocalContentRepository(database);
      await repository.saveProxyUrl('http://127.0.0.1:7897');
      expect(await repository.loadProxyUrl(), 'http://127.0.0.1:7897');
    });
  }
}
