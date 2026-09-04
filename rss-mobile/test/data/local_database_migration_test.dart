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

  test('migrates schema v1 to v2 and adds persistent proxy settings', () async {
    final connection = await verifier.startAt(1);
    final database = LocalDatabase(connection);
    addTearDown(database.close);

    await verifier.migrateAndValidate(database, 2);

    final columns = await database
        .customSelect('PRAGMA table_info(user_settings)')
        .get();
    expect(
      columns.map((row) => row.read<String>('name')),
      contains('proxy_url'),
    );

    final repository = LocalContentRepository(database);
    await repository.saveProxyUrl('http://127.0.0.1:7897');
    expect(await repository.loadProxyUrl(), 'http://127.0.0.1:7897');
  });
}
