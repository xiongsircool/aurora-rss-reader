import 'dart:convert';
import 'dart:typed_data';

import 'package:aurora_mobile/application/ports/feed_http_client.dart';
import 'package:aurora_mobile/application/use_cases/refresh_feed.dart';
import 'package:aurora_mobile/data/database/local_database.dart';
import 'package:aurora_mobile/data/repositories/local_content_repository.dart';
import 'package:aurora_mobile/domain/entities/feed.dart';
import 'package:aurora_mobile/features/inbox/refresh_status_banner.dart';
import 'package:aurora_mobile/features/reader/mobile_reader_controller.dart';
import 'package:aurora_mobile/platform/http/io_feed_http_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _Client implements FeedHttpClient {
  final calls = <Uri>[];
  bool fail = true;
  @override
  Future<FeedHttpResponse> get(
    Uri uri, {
    Duration timeout = const Duration(seconds: 30),
    int maxBytes = 10485760,
    String? accept,
    String? userAgent,
    Uri? referer,
  }) async {
    calls.add(uri);
    if (fail) throw const FeedHttpException('Unavailable', statusCode: 503);
    return FeedHttpResponse(
      requestedUri: uri,
      finalUri: uri,
      statusCode: 200,
      headers: const {},
      body: Uint8List.fromList(
        utf8.encode(
          '<rss version="2.0"><channel><title>Recovered</title></channel></rss>',
        ),
      ),
    );
  }

  @override
  void close() {}
  @override
  void setProxyUrl(String? proxyUrl) {}
}

void main() {
  testWidgets(
    'many failures stay in a scrollable panel; retry only one source',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final database = LocalDatabase.memory();
      addTearDown(database.close);
      final repository = LocalContentRepository(database);
      final client = _Client();
      final controller = MobileReaderController(
        repository: repository,
        refreshFeed: RefreshFeed(httpClient: client, repository: repository),
      );
      await tester.runAsync(() async {
        for (var i = 0; i < 25; i++) {
          await repository.saveFeed(
            Feed(
              id: 'f$i',
              title: 'Source ${i.toString().padLeft(2, '0')}',
              url: Uri.parse('https://example.com/$i'),
            ),
          );
        }
        await controller.initialize();
        await controller.refreshAll();
      });
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Align(
              alignment: Alignment.topCenter,
              child: AnimatedBuilder(
                animation: controller,
                builder: (_, _) => RefreshStatusBanner(controller: controller),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Source 00'), findsNothing);
      expect(
        tester.getSize(find.byType(RefreshStatusBanner)).height,
        lessThan(110),
      );
      await tester.tap(find.text('查看'));
      await tester.pumpAndSettle();
      expect(find.text('Source 00'), findsOneWidget);
      client.calls.clear();
      client.fail = false;
      await tester.tap(find.byTooltip('重试 Source 00'));
      await tester.runAsync(() async {
        await Future<void>.delayed(const Duration(milliseconds: 100));
      });
      await tester.pumpAndSettle();
      expect(client.calls, [Uri.parse('https://example.com/0')]);
      expect(controller.refreshFailures.length, 24);
      expect(find.text('Source 00'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
}
