import 'package:aurora_mobile/application/use_cases/refresh_feed.dart';
import 'package:aurora_mobile/data/database/local_database.dart';
import 'package:aurora_mobile/data/repositories/local_content_repository.dart';
import 'package:aurora_mobile/domain/entities/feed.dart';
import 'package:aurora_mobile/platform/http/io_feed_http_client.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('fetches and persists a real RSS feed on device', (tester) async {
    const proxyUrl = String.fromEnvironment('AURORA_TEST_PROXY');
    final database = LocalDatabase.onDevice();
    final httpClient = IoFeedHttpClient(
      proxyUrl: proxyUrl.isEmpty ? null : proxyUrl,
    );
    addTearDown(() async {
      httpClient.close();
      await database.close();
    });
    final repository = LocalContentRepository(database);
    final refreshFeed = RefreshFeed(
      httpClient: httpClient,
      repository: repository,
    );
    const feedId = 'integration-real-hacker-news';

    await repository.deleteFeed(feedId);
    final result = await refreshFeed(
      Feed(
        id: feedId,
        title: 'Hacker News',
        url: Uri.parse('https://news.ycombinator.com/rss'),
      ),
    );
    final page = await repository.listInbox(limit: 50);

    expect(result.fetchedEntries, greaterThan(0));
    expect(result.insertedEntries, greaterThan(0));
    expect(page.entries.any((entry) => entry.feedId == feedId), isTrue);

    await repository.deleteFeed(feedId);
  });
}
