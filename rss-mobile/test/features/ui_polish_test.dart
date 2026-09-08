import 'package:aurora_mobile/app/aurora_app.dart';
import 'package:aurora_mobile/application/use_cases/refresh_feed.dart';
import 'package:aurora_mobile/data/database/local_database.dart';
import 'package:aurora_mobile/data/repositories/local_content_repository.dart';
import 'package:aurora_mobile/domain/entities/feed.dart';
import 'package:aurora_mobile/domain/feed_parsing/feed_parser.dart';
import 'package:aurora_mobile/features/reader/article_reader_page.dart';
import 'package:aurora_mobile/features/reader/mobile_reader_controller.dart';
import 'package:aurora_mobile/features/reader/share_card_preview_page.dart';
import 'package:aurora_mobile/platform/http/io_feed_http_client.dart';
import 'package:aurora_mobile/shared/clear_glass_surface.dart';
import 'package:aurora_mobile/shared/share_card_content.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'dart:convert';
import 'dart:typed_data';

void main() {
  late LocalDatabase db;
  late IoFeedHttpClient http;
  late MobileReaderController controller;
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    db = LocalDatabase.memory();
    http = IoFeedHttpClient();
    final repository = LocalContentRepository(db);
    controller = MobileReaderController(
      repository: repository,
      refreshFeed: RefreshFeed(httpClient: http, repository: repository),
    );
  });
  tearDown(() async {
    http.close();
    await db.close();
  });

  Future<void> seed(WidgetTester tester) async {
    await tester.runAsync(() async {
      await controller.repository.saveFeed(
        Feed(
          id: 'feed',
          title: 'Example',
          url: Uri.parse('https://example.com/rss'),
        ),
      );
      final parsed = parseFeedBytes(
        Uint8List.fromList(
          utf8.encode('''<rss version="2.0"><channel><title>Example</title>
        <item><guid>one</guid><title>Responsive reading test article</title><description><![CDATA[
        <p>${'Long readable paragraph. ' * 120}</p><pre>code sample that should never be covered</pre>
        ]]></description></item></channel></rss>'''),
        ),
      );
      await controller.repository.insertParsedEntries('feed', parsed.entries);
      await controller.initialize();
    });
  }

  testWidgets('narrow large-text reader tools and settings remain scrollable', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await seed(tester);
    await tester.pumpWidget(
      MaterialApp(
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context)
              .copyWith(textScaler: const TextScaler.linear(1.8)),
          child: child!,
        ),
        home: ArticleReaderPage(
          entry: controller.entries.first,
          feedTitle: 'A very long source name',
          controller: controller,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.tap(find.byTooltip('阅读设置'));
    await tester.pumpAndSettle();
    expect(find.text('字号 · 16'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'tablet opens article beside list, compact layout keeps glass navigation',
    (tester) async {
      tester.view.physicalSize = const Size(1200, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await seed(tester);
      await tester.pumpWidget(AuroraApp(controller: controller));
      await tester.pumpAndSettle();
      expect(find.byType(NavigationRail), findsOneWidget);
      await tester.tap(find.text('Responsive reading test article'));
      await tester.pumpAndSettle();
      expect(find.byType(ArticleReaderPage), findsOneWidget);
      expect(find.byType(NavigationRail), findsOneWidget);
      expect(tester.takeException(), isNull);
      tester.view.physicalSize = const Size(390, 844);
      await tester.pumpAndSettle();
      expect(find.byType(NavigationRail), findsNothing);
      expect(find.byType(ClearGlassSurface), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('large system text keeps compact navigation and header usable', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await seed(tester);
    await tester.pumpWidget(AuroraApp(controller: controller));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('设置').last);
    await tester.pumpAndSettle();
    expect(find.text('阅读与外观'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('share preview edits invalidate the image until regenerated', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: ShareCardPreviewPage(
          title: 'A card',
          feed: 'Source',
          url: 'https://example.com/article',
          content: const ShareCardContent(
            excerpt: 'Original excerpt',
            images: [],
          ),
        ),
      ),
    );
    // Rasterization is outside fake async, as in the production share flow.
    await tester.runAsync(() async {
      await Future<void>.delayed(const Duration(milliseconds: 300));
    });
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.byType(TextField),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.enterText(find.byType(TextField), 'Edited excerpt');
    await tester.pumpAndSettle();
    final button = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, '分享这张图片'),
    );
    expect(button.onPressed, isNull);
    expect(tester.takeException(), isNull);
  });
}
