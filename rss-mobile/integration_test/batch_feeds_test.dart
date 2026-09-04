import 'package:aurora_mobile/application/use_cases/refresh_feed.dart';
import 'package:aurora_mobile/data/database/local_database.dart';
import 'package:aurora_mobile/data/repositories/local_content_repository.dart';
import 'package:aurora_mobile/domain/entities/feed.dart';
import 'package:aurora_mobile/platform/http/io_feed_http_client.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  // A diverse real-world set: blog (Atom), news, podcast, video,
  // academic, Chinese/Japanese sources.
  const subscriptions = <(String, String, String)>[
    ('https://www.ruanyifeng.com/blog/atom.xml', '阮一峰', 'default'),
    ('https://github.com/flutter/flutter/releases.atom', 'Flutter Releases', '技术'),
    ('https://github.com/blog/feed', 'GitHub Blog', '技术'),
    ('https://feeds.arstechnica.com/arstechnica/index', 'Ars Technica', 'default'),
    ('https://feeds.bbci.co.uk/news/world/rss.xml', 'BBC World', 'default'),
    ('https://hnrss.org/frontpage', 'Hacker News', '技术'),
    ('https://feeds.npr.org/510318/podcast.xml', 'NPR Up First', '播客'),
    ('https://feed.syntax.fm/rss', 'Syntax FM', '播客'),
    ('https://www3.nhk.or.jp/rss/news/cat0.xml', 'NHK News', 'default'),
    ('https://export.arxiv.org/rss/cs.AI', 'arXiv AI', '学术'),
    ('https://www.v2ex.com/index.xml', 'V2EX', 'default'),
    ('https://9to5mac.com/feed/', '9to5Mac', '技术'),
  ];

  testWidgets('batch add real feeds to the on-device database', (tester) async {
    final database = LocalDatabase.onDevice();
    final httpClient = IoFeedHttpClient();
    addTearDown(() async {
      httpClient.close();
      await database.close();
    });

    final repository = LocalContentRepository(database);
    final refreshFeed = RefreshFeed(
      httpClient: httpClient,
      repository: repository,
    );

    var totalFeeds = 0;
    var totalEntries = 0;
    final failures = <String, Object>{};

    for (final (url, title, group) in subscriptions) {
      final feedId = 'batch-${title.hashCode.toRadixString(16)}';
      await repository.deleteFeed(feedId);
      try {
        final result = await refreshFeed(
          Feed(
            id: feedId,
            title: title,
            url: Uri.parse(url),
            groupName: group,
          ),
        );
        totalFeeds++;
        totalEntries += result.insertedEntries;
        // ignore: avoid_print
        print(
          'ADDED $title fetched=${result.fetchedEntries} '
          'inserted=${result.insertedEntries}',
        );
      } catch (error) {
        failures[title] = error;
        // ignore: avoid_print
        print('FAILED $title: $error');
      }
    }

    // ignore: avoid_print
    print(
      'SUMMARY feeds=$totalFeeds/${subscriptions.length} '
      'entries=$totalEntries failures=${failures.length}',
    );

    // At least 10 of 12 should succeed on a working network.
    expect(totalFeeds, greaterThan(9));
    expect(totalEntries, greaterThan(50));
  });
}
