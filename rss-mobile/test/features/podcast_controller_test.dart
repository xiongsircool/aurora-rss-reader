import 'dart:async';

import 'package:aurora_mobile/data/database/local_database.dart';
import 'package:aurora_mobile/data/repositories/reader_prefs_repository.dart';
import 'package:aurora_mobile/features/audio/podcast_controller.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fake_podcast_engine.dart';

void main() {
  late LocalDatabase database;
  late ReaderPrefsRepository prefs;
  late PodcastController player;
  late List<FakePodcastEngine> engines;
  PodcastEpisode episode(String name) => PodcastEpisode(
    url: Uri.parse('https://example.test/$name.mp3'),
    title: name,
    feedTitle: 'Podcast',
  );
  setUp(() {
    database = LocalDatabase.memory();
    prefs = ReaderPrefsRepository(database);
    engines = [];
    player = PodcastController(
      prefs: prefs,
      engineFactory: () {
        final engine = FakePodcastEngine();
        engines.add(engine);
        return engine;
      },
    );
  });
  tearDown(() async {
    await player.close();
    player.dispose();
    await database.close();
  });

  test('legacy position is migrated to a stable URL key', () async {
    final url = episode('legacy').url.toString();
    await prefs.saveFontSize(16); // Ensure the preferences table exists.
    await database.customStatement(
      'INSERT INTO app_prefs(key, value) VALUES (?, ?)',
      ['podcast_pos_${url.hashCode.toRadixString(36)}', '88'],
    );
    expect(await prefs.loadPlaybackPosition(url), '88');
    await prefs.savePlaybackPosition(url, 111);
    final reopened = ReaderPrefsRepository(database);
    expect(await reopened.loadPlaybackPosition(url), '111');
  });

  test('same episode never reloads; pause and resume keep position', () async {
    await player.start(episode('one'));
    engines.single.advance(const Duration(seconds: 123));
    await player.start(episode('one'));
    expect(engines.length, 1);
    expect(engines.single.loads, 1);
    expect(player.position.inSeconds, 123);
    await player.pause();
    expect(player.playing, isFalse);
    await player.play();
    expect(player.playing, isTrue);
    expect(
      await prefs.loadPlaybackPosition(episode('one').url.toString()),
      '123',
    );
  });

  test(
    'switch saves old episode and resumes new; only one engine survives',
    () async {
      await prefs.savePlaybackPosition(episode('two').url.toString(), 90);
      await player.start(episode('one'));
      engines.single.advance(const Duration(seconds: 135));
      await player.start(episode('two'));
      expect(engines.first.disposed, isTrue);
      expect(engines.last.initial.inSeconds, 90);
      expect(
        await prefs.loadPlaybackPosition(episode('one').url.toString()),
        '135',
      );
      expect(player.episode!.title, 'two');
      expect(player.playing, isTrue);
    },
  );

  test(
    'failure can retry at saved position without wiping it to zero',
    () async {
      await player.close();
      player.dispose();
      player = PodcastController(
        prefs: prefs,
        engineFactory: () {
          final engine = FakePodcastEngine()..failLoad = engines.isEmpty;
          engines.add(engine);
          return engine;
        },
      );
      await prefs.savePlaybackPosition(episode('one').url.toString(), 120);
      await player.start(episode('one'));
      expect(player.error, isNotNull);
      expect(player.loading, isFalse);
      expect(engines.first.disposed, isTrue);
      await player.retry();
      expect(player.error, isNull);
      expect(engines.last.initial.inSeconds, 120);
      expect(player.playing, isTrue);
    },
  );

  test('closing during a pending load cannot start audio later', () async {
    await player.close();
    player.dispose();
    final slow = FakePodcastEngine()..loadGate = Completer<Duration?>();
    player = PodcastController(prefs: prefs, engineFactory: () => slow);
    final loading = player.start(episode('one'));
    await slow.loadStarted.future;
    await player.close();
    await loading;
    expect(player.episode, isNull);
    expect(slow.plays, 0);
    expect(slow.disposed, isTrue);
  });

  test('rapid source switch rejects old load and stale events', () async {
    await player.close();
    player.dispose();
    final slow = FakePodcastEngine()..loadGate = Completer<Duration?>();
    final fast = FakePodcastEngine();
    var count = 0;
    player = PodcastController(
      prefs: prefs,
      engineFactory: () => count++ == 0 ? slow : fast,
    );
    final first = player.start(episode('one'));
    await slow.loadStarted.future;
    await player.start(episode('two'));
    await first;
    expect(player.episode!.title, 'two');
    expect(slow.plays, 0);
    expect(slow.disposed, isTrue);
    expect(fast.playing, isTrue);
    expect(player.error, isNull);
  });

  test(
    'completed episode does not auto-advance, replay seeks to start',
    () async {
      await player.start(episode('one'));
      engines.single.complete();
      expect(player.completed, isTrue);
      expect(player.playing, isFalse);
      expect(engines.length, 1);
      await player.play();
      expect(engines.single.seeks.last, Duration.zero);
      await player.seek(const Duration(seconds: -10));
      expect(player.position, Duration.zero);
      await player.seek(const Duration(hours: 1));
      expect(player.position, const Duration(minutes: 10));
    },
  );

  test('foreground exit pauses and explicit close saves progress', () async {
    await player.start(episode('one'));
    engines.single.advance(const Duration(seconds: 321));
    await player.suspend();
    expect(player.playing, isFalse);
    expect(player.episode, isNotNull);
    await player.close();
    expect(player.episode, isNull);
    expect(
      await prefs.loadPlaybackPosition(episode('one').url.toString()),
      '321',
    );
  });
}
