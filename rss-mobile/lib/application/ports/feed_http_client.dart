import 'dart:typed_data';

final class FeedHttpResponse {
  const FeedHttpResponse({
    required this.requestedUri,
    required this.finalUri,
    required this.statusCode,
    required this.headers,
    required this.body,
  });

  final Uri requestedUri;
  final Uri finalUri;
  final int statusCode;
  final Map<String, List<String>> headers;
  final Uint8List body;

  String? header(String name) {
    final values = headers[name.toLowerCase()];
    return values == null || values.isEmpty ? null : values.join(', ');
  }
}

abstract interface class FeedHttpClient {
  Future<FeedHttpResponse> get(
    Uri uri, {
    Duration timeout = const Duration(seconds: 20),
    int maxBytes = 10 * 1024 * 1024,
  });

  void setProxyUrl(String? proxyUrl);

  void close();
}
