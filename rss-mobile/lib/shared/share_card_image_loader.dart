import 'dart:async';
import 'dart:ui' as ui;

import '../platform/http/io_feed_http_client.dart';

/// Downloads optional artwork with bounded bytes, pixels and total time.
/// Any network/codec failure falls back to a text-only share card.
Future<ui.Image?> loadShareCardImage(
  List<Uri> candidates, {
  String? proxyUrl,
  Uri? referer,
  Duration timeout = const Duration(seconds: 10),
}) async {
  final client = IoFeedHttpClient(
    proxyUrl: proxyUrl,
    useEnvironmentProxy: false,
  );
  final deadline = DateTime.now().add(timeout);
  try {
    for (final uri in candidates.take(3)) {
      final remaining = deadline.difference(DateTime.now());
      if (remaining <= Duration.zero) break;
      ui.ImmutableBuffer? buffer;
      ui.ImageDescriptor? descriptor;
      ui.Codec? codec;
      try {
        final response = await client
            .get(
              uri,
              timeout: remaining,
              maxBytes: 8 * 1024 * 1024,
              accept: 'image/*',
              referer: referer,
            )
            .timeout(remaining);
        if (response.body.isEmpty) continue;
        buffer = await ui.ImmutableBuffer.fromUint8List(response.body);
        descriptor = await ui.ImageDescriptor.encoded(buffer);
        if (descriptor.width <= 2 ||
            descriptor.height <= 2 ||
            descriptor.width * descriptor.height > 24000000) {
          continue;
        }
        codec = await descriptor.instantiateCodec(
          targetWidth: descriptor.width > 1200 ? 1200 : descriptor.width,
        );
        return (await codec.getNextFrame()).image;
      } catch (_) {
        // Try the next body image when a cover is missing or unavailable.
      } finally {
        codec?.dispose();
        descriptor?.dispose();
        buffer?.dispose();
      }
    }
    return null;
  } finally {
    client.close();
  }
}
