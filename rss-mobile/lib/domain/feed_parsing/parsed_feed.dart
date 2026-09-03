/// A parsed feed document, normalized across RSS 2.0 / Atom / Media RSS.
final class ParsedFeed {
  const ParsedFeed({
    required this.title,
    required this.link,
    required this.format,
    required this.entries,
    this.description,
    this.updatedAt,
  });

  /// Feed title; falls back to the feed URL when a document has none.
  final String title;

  /// Primary site link (HTML), not the feed URL itself.
  final Uri? link;

  /// Detected source format: `rss2` or `atom`.
  final FeedFormat format;

  final String? description;

  final DateTime? updatedAt;

  final List<ParsedEntry> entries;
}

enum FeedFormat { rss2, atom }

/// A normalized feed item, independent of source format.
final class ParsedEntry {
  const ParsedEntry({
    required this.guid,
    required this.title,
    this.link,
    this.author,
    this.summaryHtml,
    this.contentHtml,
    this.publishedAt,
    this.updatedAt,
    this.enclosure = const [],
    this.imageUrls = const [],
    this.videoUrl,
    this.duration,
    this.doi,
    this.pmid,
    this.categories = const [],
  });

  /// Stable identity for dedup. Derived from guid/id, falling back to link
  /// or title hash when a feed omits all explicit identifiers.
  final String guid;

  final String title;

  final Uri? link;

  final String? author;

  /// Short description (RSS description / Atom summary).
  final String? summaryHtml;

  /// Full content when present (RSS content:encoded / Atom content).
  final String? contentHtml;

  final DateTime? publishedAt;

  final DateTime? updatedAt;

  final List<ParsedEnclosure> enclosure;

  final List<String> imageUrls;

  /// Direct video URL when the item is a video entry (Media RSS video,
  /// YouTube/Bilibili link, or enclosure).
  final Uri? videoUrl;

  /// Podcast/video duration when supplied by iTunes or RSS extensions.
  final Duration? duration;

  final String? doi;

  final String? pmid;

  final List<String> categories;
}

final class ParsedEnclosure {
  const ParsedEnclosure({
    required this.url,
    required this.type,
    this.lengthInBytes,
  });

  final Uri url;

  /// MIME type such as `audio/mpeg` or `image/jpeg`.
  final String type;

  final int? lengthInBytes;

  bool get isAudio => type.startsWith('audio/');
  bool get isImage => type.startsWith('image/');
  bool get isVideo => type.startsWith('video/');
}
