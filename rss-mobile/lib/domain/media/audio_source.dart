import 'package:html/parser.dart' as html_parser;

/// Audio MIME types take precedence. Infer common audio extensions only when
/// the server omitted a meaningful MIME type, never override image/video types.
bool isAudioAttachment(Uri url, String? type) {
  final mime = (type ?? '').split(';').first.trim().toLowerCase();
  if (mime.startsWith('audio/')) return true;
  if (mime.isNotEmpty && mime != 'application/octet-stream') return false;
  final path = url.path.toLowerCase();
  return const [
    '.mp3',
    '.m4a',
    '.aac',
    '.ogg',
    '.oga',
    '.opus',
    '.wav',
    '.flac',
  ].any(path.endsWith);
}

Uri? findArticleAudio({
  Uri? attachment,
  String? attachmentType,
  String? html,
  Uri? baseUrl,
}) {
  Uri? resolve(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;
    final candidate = Uri.tryParse(raw.trim());
    if (candidate == null) return null;
    final uri = baseUrl?.resolveUri(candidate) ?? candidate;
    return ['http', 'https'].contains(uri.scheme) && uri.host.isNotEmpty
        ? uri
        : null;
  }

  if (attachment != null && isAudioAttachment(attachment, attachmentType)) {
    final uri = resolve(attachment.toString());
    if (uri != null) return uri;
  }
  if (html == null || html.isEmpty) return null;
  final document = html_parser.parseFragment(html);
  for (final audio in document.querySelectorAll('audio')) {
    final direct = resolve(audio.attributes['src']);
    if (direct != null) return direct;
    for (final source in audio.querySelectorAll('source')) {
      final uri = resolve(source.attributes['src']);
      if (uri != null) return uri;
    }
  }
  return null;
}
