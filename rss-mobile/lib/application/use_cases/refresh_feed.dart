import '../../data/repositories/local_content_repository.dart';
import '../../domain/entities/feed.dart';
import '../../domain/feed_parsing/feed_parser.dart';
import '../ports/feed_http_client.dart';

final class RefreshFeedResult {
  const RefreshFeedResult({
    required this.feedId,
    required this.feedTitle,
    required this.fetchedEntries,
    required this.insertedEntries,
    required this.finalUri,
  });

  final String feedId;
  final String feedTitle;
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
    try {
      return await _ingest(feed, response);
    } on FeedParseException {
      final head = String.fromCharCodes(response.body.take(512))
          .trimLeft()
          .toLowerCase();
      final looksHtml =
          head.startsWith('<!doctype html') || head.startsWith('<html');
      if (!looksHtml) rethrow;
      // The URL is a webpage (site retired its feed or the user pasted a
      // homepage). Discover the real feed from <link rel="alternate">.
      final discovered = _discoverFeedLink(
        String.fromCharCodes(response.body),
        response.finalUri,
      );
      if (discovered == null || discovered == response.finalUri) rethrow;
      final retry = await httpClient.get(discovered);
      final parsed = parseFeedBytes(retry.body, feedUrl: retry.finalUri);

      final storedFeed = feed.copyWith(title: parsed.title);
      await repository.saveFeed(storedFeed);
      final inserted = await repository.insertParsedEntries(
        feed.id,
        parsed.entries,
      );
      return RefreshFeedResult(
        feedId: feed.id,
        feedTitle: parsed.title,
        fetchedEntries: parsed.entries.length,
        insertedEntries: inserted,
        finalUri: retry.finalUri,
      );
    }
  }

  Future<RefreshFeedResult> _ingest(
    Feed feed,
    FeedHttpResponse response,
  ) async {
    final parsed = parseFeedBytes(response.body, feedUrl: response.finalUri);

    // The parsed document is complete at this point; only now mutate storage.
    final storedFeed = feed.copyWith(title: parsed.title);
    await repository.saveFeed(storedFeed);
    final inserted = await repository.insertParsedEntries(
      feed.id,
      parsed.entries,
    );

    return RefreshFeedResult(
      feedId: feed.id,
      feedTitle: parsed.title,
      fetchedEntries: parsed.entries.length,
      insertedEntries: inserted,
      finalUri: response.finalUri,
    );
  }

  /// Finds an RSS/Atom link in an HTML page, resolved against its URL.
  Uri? _discoverFeedLink(String html, Uri baseUrl) {
    final tags = RegExp('<link[^>]+>', caseSensitive: false).allMatches(html);
    for (final tag in tags) {
      final tagText = tag.group(0)!;
      final rel =
          RegExp(
            'rel=["\']([^"\']*)',
            caseSensitive: false,
          ).firstMatch(tagText)?.group(1) ??
          '';
      if (!rel.toLowerCase().contains('alternate')) continue;
      final type =
          RegExp(
            'type=["\']([^"\']*)',
            caseSensitive: false,
          ).firstMatch(tagText)?.group(1) ??
          '';
      if (!type.contains('rss') && !type.contains('atom')) continue;
      final href = RegExp(
        'href=["\']([^"\']*)',
        caseSensitive: false,
      ).firstMatch(tagText)?.group(1);
      if (href == null || href.isEmpty) continue;
      return baseUrl.resolve(href);
    }
    return null;
  }
}
