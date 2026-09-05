import 'dart:convert';

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

  Future<Map<String, dynamic>?> loadAiExtendedSettings() async {
    await _ensureTable();
    final rows = await _db
        .customSelect(
          "SELECT value FROM app_prefs WHERE key = 'ai_extended_settings'",
        )
        .get();
    if (rows.isEmpty) return null;
    final json = rows.first.read<String>('value');
    return _decodeJson(json);
  }

  Future<void> saveAiExtendedSettings(Map<String, dynamic> settings) async {
    await _ensureTable();
    await _db.customStatement(
      "INSERT INTO app_prefs(key, value, updated_at) "
      "VALUES('ai_extended_settings', ?, datetime('now')) "
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value, "
      "updated_at = excluded.updated_at",
      [_encodeJson(settings)],
    );
  }

  String _encodeJson(Map<String, dynamic> map) => jsonEncode(map);

  Map<String, dynamic>? _decodeJson(String raw) {
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) return decoded;
    } on FormatException {
      // fallthrough
    }
    return null;
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
