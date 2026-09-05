import 'package:drift/drift.dart';

/// Reading display preferences stored in a dedicated key-value table.
class ReaderPrefsRepository {
  const ReaderPrefsRepository(this._db);

  final GeneratedDatabase _db;

  Future<void> _ensureTable() async {
    await _db.customStatement(
      'CREATE TABLE IF NOT EXISTS app_prefs ('
      'key TEXT PRIMARY KEY, value TEXT NOT NULL, '
      "updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
    );
  }

  Future<String?> _get(String key) async {
    await _ensureTable();
    final rows = await _db
        .customSelect(
          'SELECT value FROM app_prefs WHERE key = ?',
          variables: [Variable<String>(key)],
        )
        .get();
    return rows.isEmpty ? null : rows.first.read<String>('value');
  }

  Future<void> _set(String key, String value) async {
    await _ensureTable();
    await _db.customStatement(
      'INSERT INTO app_prefs(key, value, updated_at) '
      "VALUES(?, ?, datetime('now')) "
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value, '
      'updated_at = excluded.updated_at',
      [key, value],
    );
  }

  Future<double> loadFontSize() async {
    return double.tryParse(await _get('reader_font_size') ?? '') ?? 16.0;
  }

  Future<void> saveFontSize(double size) =>
      _set('reader_font_size', size.toString());

  Future<double> loadLineHeight() async {
    return double.tryParse(await _get('reader_line_height') ?? '') ?? 1.65;
  }

  Future<void> saveLineHeight(double height) =>
      _set('reader_line_height', height.toString());
}
