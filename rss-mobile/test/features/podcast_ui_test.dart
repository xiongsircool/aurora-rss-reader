import 'package:aurora_mobile/app/aurora_app.dart';
import 'package:aurora_mobile/application/use_cases/refresh_feed.dart';
import 'package:aurora_mobile/data/database/local_database.dart';
import 'package:aurora_mobile/data/repositories/local_content_repository.dart';
import 'package:aurora_mobile/data/repositories/reader_prefs_repository.dart';
import 'package:aurora_mobile/features/audio/podcast_controller.dart';
import 'package:aurora_mobile/features/reader/mobile_reader_controller.dart';
import 'package:aurora_mobile/features/reader/podcast_player_sheet.dart';
import 'package:aurora_mobile/platform/http/io_feed_http_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/fake_podcast_engine.dart';

class _MemoryPlaybackPrefs extends ReaderPrefsRepository {
  _MemoryPlaybackPrefs(super.database);
  final positions = <String, String>{};
  @override
  Future<String?> loadPlaybackPosition(String url) async => positions[url];
  @override
  Future<void> savePlaybackPosition(String url, int seconds) async {
    positions[url] = '$seconds';
  }
}

void main() {
  late LocalDatabase database;
  late FakePodcastEngine engine;
  late PodcastController player;
  late MobileReaderController controller;
  late IoFeedHttpClient http;
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    database = LocalDatabase.memory();
    final repository = LocalContentRepository(database);
    engine = FakePodcastEngine();
    player = PodcastController(
      prefs: _MemoryPlaybackPrefs(database),
      engineFactory: () => engine,
    );
    http = IoFeedHttpClient();
    controller = MobileReaderController(
      repository: repository,
      refreshFeed: RefreshFeed(httpClient: http, repository: repository),
      podcast: player,
    );
  });
  tearDown(() async {
    player.dispose();
    http.close();
    await database.close();
  });

  Future<void> start(WidgetTester tester) async {
    await tester.runAsync(
      () => player.start(
        PodcastEpisode(
          url: Uri.parse('https://example.test/episode.mp3'),
          title: 'A playing episode',
          feedTitle: 'Podcast',
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> finish(WidgetTester tester) async {
    var finished = false;
    player.close().then((_) => finished = true);
    for (var i = 0; i < 20 && !finished; i++) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 5)),
      );
      await tester.pump();
    }
    expect(
      finished,
      isTrue,
      reason: 'engine disposal and persistence must complete',
    );
  }

  testWidgets(
    'mini player persists across tabs and search; closing controls keeps playing',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(AuroraApp(controller: controller));
      await tester.pumpAndSettle();
      await start(tester);
      expect(find.byKey(const ValueKey('mini-player-open')), findsOneWidget);
      expect(engine.playing, isTrue);
      await tester.tap(find.byKey(const ValueKey('mini-player-open')));
      await tester.pumpAndSettle();
      expect(find.byType(PodcastPlayerSheet), findsOneWidget);
      expect(find.byKey(const ValueKey('mini-player-open')), findsNothing);
      await tester.tap(find.byTooltip('收起播放器，继续播放'));
      await tester.pumpAndSettle();
      expect(engine.playing, isTrue);
      expect(engine.disposed, isFalse);
      await tester.tap(find.byIcon(Icons.settings_outlined));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('mini-player-open')), findsOneWidget);
      await tester.tap(find.byIcon(Icons.inbox_outlined));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('搜索'));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('mini-player-open')), findsOneWidget);
      expect(engine.loads, 1);
      await tester.tap(find.byKey(const ValueKey('mini-player-close')));
      await finish(tester);
      expect(find.byKey(const ValueKey('mini-player-open')), findsNothing);
      expect(engine.disposed, isTrue);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('slider seeks only on release, and only once', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: PodcastPlayerSheet(controller: player)),
      ),
    );
    await start(tester);
    var slider = tester.widget<Slider>(
      find.byKey(const ValueKey('podcast-seek')),
    );
    slider.onChanged!(0.2);
    slider.onChanged!(0.4);
    slider.onChanged!(0.5);
    await tester.pump();
    expect(engine.seeks, isEmpty);
    slider = tester.widget<Slider>(find.byKey(const ValueKey('podcast-seek')));
    slider.onChangeEnd!(0.5);
    await tester.pumpAndSettle();
    expect(engine.seeks, [const Duration(minutes: 5)]);
    await finish(tester);
  });

  testWidgets('mini-player remains usable with large text on a narrow screen', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 720);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await tester.pumpWidget(AuroraApp(controller: controller));
    await tester.pumpAndSettle();
    await start(tester);
    expect(
      find.byKey(const ValueKey('mini-player-toggle')).hitTestable(),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey('mini-player-close')).hitTestable(),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
    await finish(tester);
  });
}
