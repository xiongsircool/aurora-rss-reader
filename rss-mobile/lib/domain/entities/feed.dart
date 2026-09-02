import '../value_objects/feed_view_type.dart';

final class Feed {
  const Feed({
    required this.id,
    required this.title,
    required this.url,
    this.groupName = 'default',
    this.viewType = FeedViewType.articles,
    this.updateInterval = const Duration(hours: 12),
  });

  final String id;
  final String title;
  final Uri url;
  final String groupName;
  final FeedViewType viewType;
  final Duration updateInterval;
}
