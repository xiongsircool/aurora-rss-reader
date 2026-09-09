import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:aurora_mobile/application/ports/feed_http_client.dart';
import 'package:aurora_mobile/application/use_cases/refresh_feed.dart';
import 'package:aurora_mobile/data/database/local_database.dart';
import 'package:aurora_mobile/data/repositories/local_content_repository.dart';
import 'package:aurora_mobile/data/services/favicon_resolver.dart';
import 'package:aurora_mobile/features/reader/mobile_reader_controller.dart';
import 'package:aurora_mobile/platform/http/io_feed_http_client.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FeedClient implements FeedHttpClient {
  @override
  Future<FeedHttpResponse> get(
    Uri uri, {
    Duration timeout = const Duration(seconds: 30),
    int maxBytes = 10485760,
    String? accept,
    String? userAgent,
    Uri? referer,
  }) async {
    return FeedHttpResponse(
      requestedUri: uri,
      finalUri: uri,
      statusCode: 200,
      headers: const {},
      body: Uint8List.fromList(
        utf8.encode(
          '<rss version="2.0"><channel><title>New feed</title>'
          '${List.generate(120, (i) => '<item><guid>$i</guid><title>Article $i</title></item>').join()}'
          '</channel></rss>',
        ),
      ),
    );
  }

  @override
  void setProxyUrl(String? proxyUrl) {}
  @override
  void close() {}
}

class _Resolver extends FaviconResolver {
  _Resolver(super.client);
  final result = Completer<Uri?>();
  final calls = <Uri>[];
  @override
  Future<Uri?> resolve(Uri url) {
    calls.add(url);
    return result.future;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'new subscription resolves and displays icon without resetting pagination',
    () async {
      SharedPreferences.setMockInitialValues({});
      final database = LocalDatabase.memory();
      final repository = LocalContentRepository(database);
      final iconClient = IoFeedHttpClient();
      final resolver = _Resolver(iconClient);
      final controller = MobileReaderController(
        repository: repository,
        refreshFeed: RefreshFeed(
          repository: repository,
          httpClient: _FeedClient(),
        ),
      )..faviconResolver = resolver;
      addTearDown(() async {
        iconClient.close();
        await database.close();
      });
      await controller.initialize();
      expect(await controller.addFeed('https://example.test/feed'), isTrue);
      expect(resolver.calls, [Uri.parse('https://example.test/feed')]);
      await controller.loadMore();
      final ids = controller.entries.map((e) => e.id).toList();
      expect(ids.length, 100);
      final feedId = controller.feeds.single.id;
      final changed = Completer<void>();
      controller.addListener(() {
        if (controller.feedIconUrl(feedId) != null && !changed.isCompleted) {
          changed.complete();
        }
      });
      resolver.result.complete(Uri.parse('https://example.test/icon.png'));
      await changed.future.timeout(const Duration(seconds: 3));
      expect(controller.feedIconUrl(feedId), 'https://example.test/icon.png');
      expect(controller.entries.map((e) => e.id), ids);
      expect(
        (await repository.listFeeds()).single.iconUrl.toString(),
        'https://example.test/icon.png',
      );
    },
  );
}
