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
    this.imageUrl,
    this.publishedAt,
    this.readAt,
    this.isStarred = false,
  });

  final String id;
  final String feedId;
  final String guid;
  final String title;
  final Uri? url;
  final String? author;
  final String? summary;
  final Uri? imageUrl;
  final DateTime? publishedAt;
  final DateTime insertedAt;
  final DateTime? readAt;
  final bool isStarred;

  bool get isRead => readAt != null;

  Entry markRead(DateTime at) => copyWith(readAt: at);

  Entry markUnread() => copyWith(clearReadAt: true);

  Entry copyWith({
    DateTime? readAt,
    bool clearReadAt = false,
    bool? isStarred,
  }) {
    return Entry(
      id: id,
      feedId: feedId,
      guid: guid,
      title: title,
      url: url,
      author: author,
      summary: summary,
      imageUrl: imageUrl,
      publishedAt: publishedAt,
      insertedAt: insertedAt,
      readAt: clearReadAt ? null : (readAt ?? this.readAt),
      isStarred: isStarred ?? this.isStarred,
    );
  }
}
