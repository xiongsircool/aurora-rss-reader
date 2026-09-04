import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Stores sensitive values (API keys) in the platform secure storage:
/// iOS Keychain / Android Keystore.
class SecureKeyStore {
  const SecureKeyStore();

  static const _storage = FlutterSecureStorage();

  static const _summaryKeyPrefix = 'ai_key_summary_';
  static const _translationKeyPrefix = 'ai_key_translation_';

  Future<void> saveSummaryKey(String key) =>
      _storage.write(key: '${_summaryKeyPrefix}current', value: key);

  Future<String?> loadSummaryKey() =>
      _storage.read(key: '${_summaryKeyPrefix}current');

  Future<void> saveTranslationKey(String key) =>
      _storage.write(key: '${_translationKeyPrefix}current', value: key);

  Future<String?> loadTranslationKey() =>
      _storage.read(key: '${_translationKeyPrefix}current');

  Future<void> deleteAll() async {
    await _storage.delete(key: '${_summaryKeyPrefix}current');
    await _storage.delete(key: '${_translationKeyPrefix}current');
  }
}
