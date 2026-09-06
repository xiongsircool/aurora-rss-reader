import 'dart:io';

import '../../domain/entities/feed.dart';
import '../../platform/http/io_feed_http_client.dart';

/// Downloads and caches a feed icon on local storage.
/// Any failure returns null so the UI keeps its letter avatar.
class FeedIconCache {
  FeedIconCache(this._directory, {IoFeedHttpClient? client})
    : _client = client ?? IoFeedHttpClient(useEnvironmentProxy: true);

  final Directory _directory;
  final IoFeedHttpClient _client;

  static const _maxBytes = 256 * 1024;

  /// Returns a local file for [feed], or null when unavailable.
  /// The cache path is stable per feed URL.
  Future<File?> load(Feed feed) async {
    final iconUrl = feed.iconUrl;
    if (iconUrl == null) return null;
    final key = Uri.encodeComponent(feed.url.toString());
    final file = File('${_directory.path}/$key');
    if (await file.exists()) {
      final length = await file.length();
      if (length > 0 && length <= _maxBytes) return file;
      await file.delete();
    }
    try {
      await _directory.create(recursive: true);
      final response = await _client.get(
        iconUrl,
        timeout: const Duration(seconds: 8),
        maxBytes: _maxBytes,
        accept: 'image/*',
        userAgent:
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
            'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      );
      if (response.statusCode != 200 || response.body.isEmpty) return null;
      await file.writeAsBytes(response.body);
      return file;
    } catch (_) {
      return null;
    }
  }

  void close() => _client.close();
}
