import '../../data/repositories/local_content_repository.dart';
import '../../domain/entities/feed.dart';
import '../../domain/feed_parsing/feed_parser.dart';
import '../ports/feed_http_client.dart';

final class RefreshFeedResult {
  const RefreshFeedResult({
    required this.feedId,
    required this.fetchedEntries,
    required this.insertedEntries,
    required this.finalUri,
  });

  final String feedId;
  final int fetchedEntries;
  final int insertedEntries;
  final Uri finalUri;
}

/// Device-local feed refresh pipeline.
///
/// Network and XML parsing complete before any database write. A failed
/// request or malformed document therefore leaves the previous local snapshot
/// untouched.
final class RefreshFeed {
  const RefreshFeed({required this.httpClient, required this.repository});

  final FeedHttpClient httpClient;
  final LocalContentRepository repository;

  Future<RefreshFeedResult> call(Feed feed) async {
    final response = await httpClient.get(feed.url);
    final parsed = parseFeedBytes(response.body, feedUrl: response.finalUri);

    // The parsed document is complete at this point; only now mutate storage.
    await repository.saveFeed(feed);
    final inserted = await repository.insertParsedEntries(
      feed.id,
      parsed.entries,
    );

    return RefreshFeedResult(
      feedId: feed.id,
      fetchedEntries: parsed.entries.length,
      insertedEntries: inserted,
      finalUri: response.finalUri,
    );
  }
}
