import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import '../../application/ports/feed_http_client.dart';

final class FeedHttpException implements Exception {
  const FeedHttpException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => statusCode == null
      ? 'FeedHttpException: $message'
      : 'FeedHttpException($statusCode): $message';
}

final class IoFeedHttpClient implements FeedHttpClient {
  IoFeedHttpClient({
    HttpClient? client,
    String? proxyUrl,
    bool useEnvironmentProxy = true,
  }) : _client = client ?? HttpClient() {
    _useEnvironmentProxy = useEnvironmentProxy;
    // Decompress explicitly so gzip and deflate behave consistently on every
    // platform, and so the decompressed size can be limited as well.
    _client.autoUncompress = false;
    setProxyUrl(proxyUrl);
  }

  static const _userAgent = 'AuroraRSSMobile/0.1';
  final HttpClient _client;
  late final bool _useEnvironmentProxy;
  Uri? _proxy;

  @override
  void setProxyUrl(String? proxyUrl) {
    _proxy = proxyUrl == null || proxyUrl.trim().isEmpty
        ? null
        : _parseProxy(proxyUrl);
    _client.findProxy = (target) {
      final proxy = _proxy;
      if (proxy != null) return 'PROXY ${proxy.host}:${proxy.port}';
      return _useEnvironmentProxy
          ? HttpClient.findProxyFromEnvironment(target)
          : 'DIRECT';
    };
  }

  @override
  Future<FeedHttpResponse> get(
    Uri uri, {
    Duration timeout = const Duration(seconds: 20),
    int maxBytes = 10 * 1024 * 1024,
    String? accept,
  }) async {
    if (uri.scheme != 'http' && uri.scheme != 'https') {
      throw FeedHttpException('Unsupported URL scheme: ${uri.scheme}');
    }
    if (maxBytes <= 0) {
      throw const FeedHttpException('Response size limit must be positive');
    }

    try {
      final request = await _client.getUrl(uri).timeout(timeout);
      request
        ..followRedirects = true
        ..maxRedirects = 5
        ..headers.set(HttpHeaders.userAgentHeader, _userAgent)
        ..headers.set(
          HttpHeaders.acceptHeader,
          accept ?? 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.5',
        )
        ..headers.set(HttpHeaders.acceptEncodingHeader, 'gzip, deflate');

      final response = await request.close().timeout(timeout);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        await response.drain<void>();
        throw FeedHttpException(
          'Feed request failed',
          statusCode: response.statusCode,
        );
      }

      final declaredLength = response.contentLength;
      if (declaredLength > maxBytes) {
        await response.drain<void>();
        throw FeedHttpException(
          'Feed response exceeds $maxBytes bytes',
          statusCode: response.statusCode,
        );
      }

      final body = BytesBuilder(copy: false);
      await for (final chunk in response.timeout(timeout)) {
        if (body.length + chunk.length > maxBytes) {
          throw FeedHttpException(
            'Feed response exceeds $maxBytes bytes',
            statusCode: response.statusCode,
          );
        }
        body.add(chunk);
      }

      final headers = <String, List<String>>{};
      response.headers.forEach((name, values) {
        headers[name.toLowerCase()] = List.unmodifiable(values);
      });
      final finalUri = response.redirects.isEmpty
          ? uri
          : response.redirects.last.location;

      final encodedBody = body.takeBytes();
      final decodedBody = _decodeContentEncoding(
        encodedBody,
        response.headers.value(HttpHeaders.contentEncodingHeader),
      );
      if (decodedBody.length > maxBytes) {
        throw FeedHttpException(
          'Decompressed feed response exceeds $maxBytes bytes',
          statusCode: response.statusCode,
        );
      }

      return FeedHttpResponse(
        requestedUri: uri,
        finalUri: finalUri,
        statusCode: response.statusCode,
        headers: Map.unmodifiable(headers),
        body: Uint8List.fromList(decodedBody),
      );
    } on TimeoutException catch (error) {
      throw FeedHttpException('Feed request timed out: $error');
    } on SocketException catch (error) {
      throw FeedHttpException('Feed network error: ${error.message}');
    }
  }

  @override
  void close() {
    _client.close(force: true);
  }
}

Uri _parseProxy(String raw) {
  final normalized = raw.contains('://') ? raw : 'http://$raw';
  final uri = Uri.tryParse(normalized);
  if (uri == null || uri.host.isEmpty || !uri.hasPort) {
    throw ArgumentError.value(raw, 'proxyUrl', 'Expected host:port or URL');
  }
  return uri;
}

List<int> _decodeContentEncoding(List<int> bytes, String? rawEncoding) {
  final encoding = rawEncoding?.split(',').last.trim().toLowerCase();
  try {
    switch (encoding) {
      case null:
      case '':
      case 'identity':
        return bytes;
      case 'gzip':
      case 'x-gzip':
        return gzip.decode(bytes);
      case 'deflate':
        return zlib.decode(bytes);
      default:
        throw FeedHttpException('Unsupported Content-Encoding: $encoding');
    }
  } on FormatException catch (error) {
    throw FeedHttpException('Invalid $encoding response: ${error.message}');
  }
}
