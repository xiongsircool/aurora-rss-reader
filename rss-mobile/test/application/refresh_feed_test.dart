import 'dart:convert';
import 'dart:io';

import 'package:aurora_mobile/application/use_cases/refresh_feed.dart';
import 'package:aurora_mobile/data/database/local_database.dart';
import 'package:aurora_mobile/data/repositories/local_content_repository.dart';
import 'package:aurora_mobile/domain/entities/feed.dart';
import 'package:aurora_mobile/domain/feed_parsing/feed_parser.dart';
import 'package:aurora_mobile/platform/http/io_feed_http_client.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late HttpServer server;
  late Uri baseUri;
  late LocalDatabase database;
  late IoFeedHttpClient httpClient;
  late LocalContentRepository repository;
  late RefreshFeed refreshFeed;

  setUp(() async {
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    baseUri = Uri.parse('http://${server.address.host}:${server.port}');
    server.listen((request) async {
      switch (request.uri.path) {
        case '/feed':
          request.response.headers.contentType = ContentType(
            'application',
            'rss+xml',
            charset: 'utf-8',
          );
          request.response.add(
            utf8.encode('''
<rss version="2.0"><channel>
  <title>Local Test Feed</title>
  <item><guid>one</guid><title>First</title><description>alpha</description></item>
  <item><guid>two</guid><title>Second</title><description>beta</description></item>
</channel></rss>
'''),
          );
        case '/redirect':
          request.response.redirect(baseUri.resolve('/feed'));
        case '/broken':
          request.response.add(utf8.encode('<html>not a feed</html>'));
        default:
          request.response.statusCode = HttpStatus.internalServerError;
      }
      await request.response.close();
    });

    database = LocalDatabase.memory();
    httpClient = IoFeedHttpClient();
    repository = LocalContentRepository(database);
    refreshFeed = RefreshFeed(httpClient: httpClient, repository: repository);
  });

  tearDown(() async {
    httpClient.close();
    await database.close();
    await server.close(force: true);
  });

  test('fetches, parses and stores a feed entirely on device', () async {
    final feed = _feed('feed-1', baseUri.resolve('/redirect'));

    final result = await refreshFeed(feed);

    expect(result.fetchedEntries, 2);
    expect(result.insertedEntries, 2);
    expect(result.finalUri.path, '/feed');
    expect(await database.select(database.feeds).get(), hasLength(1));
    expect(await database.select(database.entries).get(), hasLength(2));
  });

  test(
    'a repeated refresh keeps existing entries and reports no inserts',
    () async {
      final feed = _feed('feed-1', baseUri.resolve('/feed'));

      final first = await refreshFeed(feed);
      final second = await refreshFeed(feed);

      expect(first.insertedEntries, 2);
      expect(second.insertedEntries, 0);
      expect(await database.select(database.entries).get(), hasLength(2));
    },
  );

  test('malformed XML does not replace an existing local snapshot', () async {
    await refreshFeed(_feed('feed-1', baseUri.resolve('/feed')));
    final before = await database.select(database.entries).get();

    await expectLater(
      refreshFeed(_feed('feed-1', baseUri.resolve('/broken'))),
      throwsA(isA<FeedParseException>()),
    );

    final after = await database.select(database.entries).get();
    expect(after.map((entry) => entry.id), before.map((entry) => entry.id));
  });

  test('HTTP failure does not create feed or entry rows', () async {
    await expectLater(
      refreshFeed(_feed('feed-failed', baseUri.resolve('/error'))),
      throwsA(isA<FeedHttpException>()),
    );

    expect(await database.select(database.feeds).get(), isEmpty);
    expect(await database.select(database.entries).get(), isEmpty);
  });
}

Feed _feed(String id, Uri url) => Feed(id: id, title: 'Local Feed', url: url);
