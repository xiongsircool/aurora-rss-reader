import 'package:html/dom.dart' as dom;
import 'package:html/parser.dart' as html_parser;

/// Share text and image candidates from the content selected in the reader.
class ShareCardContent {
  const ShareCardContent({required this.excerpt, required this.images});

  final String excerpt;
  final List<Uri> images;

  factory ShareCardContent.fromHtml({
    required String? html,
    Uri? cover,
    Uri? baseUrl,
  }) {
    final fragment = html_parser.parseFragment(html ?? '');
    for (final node in fragment.querySelectorAll('script, style, noscript')) {
      node.remove();
    }
    final images = <Uri>[];
    void add(String? value) {
      if (value == null || value.trim().isEmpty || images.length >= 3) return;
      final uri = Uri.tryParse(value.trim());
      if (uri == null) return;
      final resolved = baseUrl?.resolveUri(uri) ?? uri;
      if (!['http', 'https'].contains(resolved.scheme) ||
          resolved.host.isEmpty) {
        return;
      }
      if (!images.contains(resolved)) images.add(resolved);
    }

    add(cover?.toString());
    for (final image in fragment.querySelectorAll('img')) {
      final width = int.tryParse(image.attributes['width'] ?? '');
      final height = int.tryParse(image.attributes['height'] ?? '');
      if (image.attributes.containsKey('hidden') ||
          (width != null && width <= 2) ||
          (height != null && height <= 2)) {
        continue;
      }
      // Prefer lazy-load targets over placeholder src values.
      add(image.attributes['data-src']);
      add(image.attributes['data-original']);
      add(image.attributes['src']);
    }
    // Keep paragraph boundaries when extracting an excerpt.
    for (final block in fragment.querySelectorAll(
      'p, div, li, h1, h2, h3, br',
    )) {
      block.nodes.add(dom.Text(' '));
    }
    final plain = (fragment.text ?? '').replaceAll(RegExp(r'\s+'), ' ').trim();
    final runes = plain.runes;
    final excerpt = runes.length > 600
        ? '${String.fromCharCodes(runes.take(600))}…'
        : plain;
    return ShareCardContent(
      excerpt: excerpt,
      images: List.unmodifiable(images),
    );
  }
}
