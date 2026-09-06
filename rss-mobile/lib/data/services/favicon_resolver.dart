import 'dart:convert';

import 'package:html/parser.dart' as html_parser;

import '../../platform/http/io_feed_http_client.dart';

/// Resolves a site icon URL for a feed, using layered strategies:
/// 1. HTML <link rel="icon"> / apple-touch-icon on the site page
/// 2. Conventional /favicon.ico path
/// 3. DuckDuckGo icon service (helpful when the site blocks direct
///    fetches or is unreachable from the device network)
class FaviconResolver {
  FaviconResolver(this._client);

  final IoFeedHttpClient _client;

  static const _timeout = Duration(seconds: 8);
  static const _browserUa =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
      'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

  /// Returns a downloadable icon URL, or null when every strategy fails.
  Future<Uri?> resolve(Uri feedUrl) async {
    final candidates = <Future<Uri?> Function()>[
      () => _fromPageHtml(feedUrl),
      () => _conventionalPath(feedUrl),
      () async => _duckDuckGo(feedUrl),
    ];
    for (final candidate in candidates) {
      try {
        final uri = await candidate();
        if (uri == null) continue;
        final usable = await _isUsableImage(uri);
        if (usable) return uri;
      } catch (_) {
        // Try the next strategy; icon resolution must never break refresh.
      }
    }
    return null;
  }

  Uri _siteOrigin(Uri feedUrl) =>
      Uri.parse('${feedUrl.scheme}://${feedUrl.host}');

  Future<Uri?> _fromPageHtml(Uri feedUrl) async {
    final response = await _client.get(
      _siteOrigin(feedUrl),
      timeout: _timeout,
      maxBytes: 512 * 1024,
      accept: 'text/html',
      userAgent: _browserUa,
    );
    if (response.statusCode != 200) return null;
    final html = utf8.decode(response.body, allowMalformed: true);
    final document = html_parser.parse(html);
    // Prefer apple-touch-icon (large, clean) over plain favicon links.
    for (final rel in const ['apple-touch-icon', 'shortcut icon', 'icon']) {
      String? href;
      int? bestSize;
      for (final link in document.querySelectorAll('link')) {
        final relValue = (link.attributes['rel'] ?? '').toLowerCase();
        if (!relValue.contains(rel)) continue;
        final candidate = link.attributes['href'];
        if (candidate == null || candidate.isEmpty) continue;
        final sizes = link.attributes['sizes'];
        final parsed = int.tryParse(
          RegExp(r'(\d+)').firstMatch(sizes ?? '')?.group(1) ?? '',
        );
        if (href == null || ((parsed ?? 0) > (bestSize ?? 0))) {
          href = candidate;
          bestSize = parsed;
        }
      }
      if (href != null) return _siteOrigin(feedUrl).resolve(href);
    }
    return null;
  }

  Future<Uri?> _conventionalPath(Uri feedUrl) async {
    final icon = _siteOrigin(feedUrl).resolve('/favicon.ico');
    return await _isUsableImage(icon) ? icon : null;
  }

  Uri _duckDuckGo(Uri feedUrl) =>
      Uri.parse('https://icons.duckduckgo.com/ip3/${feedUrl.host}.ico');

  /// Downloads just enough bytes to confirm this is a real image, not an
  /// HTML error page, without keeping the whole file in memory.
  Future<bool> _isUsableImage(Uri uri) async {
    try {
      final response = await _client.get(
        uri,
        timeout: _timeout,
        maxBytes: 64 * 1024,
        accept: 'image/*',
        userAgent: _browserUa,
      );
      if (response.statusCode != 200) return false;
      if (response.body.isEmpty) return false;
      final type = (response.header('content-type') ?? '').toLowerCase();
      return type.startsWith('image/') ||
          type.contains('icon') ||
          _looksLikeImageBytes(response.body);
    } catch (_) {
      return false;
    }
  }

  static bool _looksLikeImageBytes(List<int> bytes) {
    if (bytes.length < 4) return false;
    // PNG, JPEG (FFD8FF), GIF87a/89a, ICO (00 00 01 00), WEBP (RIFF).
    const signatures = [
      [0x89, 0x50],
      [0xFF, 0xD8, 0xFF],
      [0x47, 0x49, 0x46],
      [0x00, 0x00, 0x01, 0x00],
    ];
    for (final signature in signatures) {
      if (bytes.length >= signature.length) {
        var matches = true;
        for (var i = 0; i < signature.length; i++) {
          if (bytes[i] != signature[i]) matches = false;
        }
        if (matches) return true;
      }
    }
    return bytes[0] == 0x52 &&
        bytes[1] == 0x49 &&
        bytes[8] == 0x57 &&
        bytes[9] == 0x45 &&
        bytes[10] == 0x42 &&
        bytes[11] == 0x50;
  }
}
