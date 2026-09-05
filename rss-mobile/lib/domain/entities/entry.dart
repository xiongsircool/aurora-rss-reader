enum ContentExtractionStatus { idle, running, succeeded, failed }

final class Entry {
  const Entry({
    required this.id,
    required this.feedId,
    required this.guid,
    required this.title,
    required this.insertedAt,
    this.url,
    this.author,
    this.summary,
    this.content,
    this.readabilityContent,
    this.contentSourceUrl,
    this.contentExtractedAt,
    this.contentExtractionStatus = ContentExtractionStatus.idle,
    this.contentExtractionError,
    this.imageUrl,
    this.enclosureUrl,
    this.enclosureType,
    this.enclosureDuration,
    this.publishedAt,
    this.readAt,
    this.isStarred = false,
    this.translatedTitle,
    this.sourceLang,
  });

  final String id;
  final String feedId;
  final String guid;
  final String title;
  final Uri? url;
  final String? author;
  final String? summary;
  final String? content;
  final String? readabilityContent;
  final Uri? contentSourceUrl;
  final DateTime? contentExtractedAt;
  final ContentExtractionStatus contentExtractionStatus;
  final String? contentExtractionError;
  final Uri? imageUrl;

  /// Audio/video enclosure URL for podcast entries.
  final Uri? enclosureUrl;
  final String? enclosureType;
  final Duration? enclosureDuration;
  final DateTime? publishedAt;
  final DateTime insertedAt;
  final DateTime? readAt;
  final bool isStarred;

  /// Cached AI-translated title (from translations table).
  final String? translatedTitle;

  /// Detected source language (zh/en/ja/ko/ru/unknown).
  final String? sourceLang;

  bool get isRead => readAt != null;

  Entry markRead(DateTime at) => copyWith(readAt: at);

  Entry markUnread() => copyWith(clearReadAt: true);

  Entry copyWith({
    DateTime? readAt,
    bool clearReadAt = false,
    bool? isStarred,
    String? translatedTitle,
    String? readabilityContent,
    Uri? contentSourceUrl,
    DateTime? contentExtractedAt,
    ContentExtractionStatus? contentExtractionStatus,
    String? contentExtractionError,
    bool clearContentExtractionError = false,
  }) {
    return Entry(
      id: id,
      feedId: feedId,
      guid: guid,
      title: title,
      url: url,
      author: author,
      summary: summary,
      content: content,
      readabilityContent: readabilityContent ?? this.readabilityContent,
      contentSourceUrl: contentSourceUrl ?? this.contentSourceUrl,
      contentExtractedAt: contentExtractedAt ?? this.contentExtractedAt,
      contentExtractionStatus:
          contentExtractionStatus ?? this.contentExtractionStatus,
      contentExtractionError: clearContentExtractionError
          ? null
          : (contentExtractionError ?? this.contentExtractionError),
      imageUrl: imageUrl,
      publishedAt: publishedAt,
      insertedAt: insertedAt,
      readAt: clearReadAt ? null : (readAt ?? this.readAt),
      isStarred: isStarred ?? this.isStarred,
      translatedTitle: translatedTitle ?? this.translatedTitle,
    );
  }
}
