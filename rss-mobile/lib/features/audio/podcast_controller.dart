import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';

import '../../data/repositories/reader_prefs_repository.dart';
import 'podcast_audio_engine.dart';

class PodcastEpisode {
  const PodcastEpisode({
    required this.url,
    required this.title,
    required this.feedTitle,
    this.cover,
  });
  final Uri url;
  final String title;
  final String feedTitle;
  final Uri? cover;
}

/// App-owned foreground playback session. Views never own/dispose the engine.
/// Source transitions are serialized; revision guards reject stale callbacks.
class PodcastController extends ChangeNotifier {
  PodcastController({
    required this.prefs,
    PodcastAudioEngine Function()? engineFactory,
    this.loadTimeout = const Duration(seconds: 25),
  }) : _engineFactory = engineFactory ?? JustAudioPodcastEngine.new;

  final ReaderPrefsRepository prefs;
  final PodcastAudioEngine Function() _engineFactory;
  final Duration loadTimeout;
  PodcastAudioEngine? _engine;
  final List<StreamSubscription<dynamic>> _subscriptions = [];
  PodcastEpisode? _episode;
  PodcastEpisode? get episode => _episode;
  PlayerState _state = PlayerState(false, ProcessingState.idle);
  Duration position = Duration.zero;
  Duration duration = Duration.zero;
  double speed = 1;
  bool loading = false;
  bool resumed = false;
  String? error;
  bool _ready = false;
  bool _disposed = false;
  int _revision = 0;
  Duration? _lastSaved;
  Future<void> _transitions = Future.value();
  Future<void> _writes = Future.value();
  bool get completed => _state.processingState == ProcessingState.completed;
  bool get playing => _state.playing && !completed && error == null;
  bool get buffering => _state.processingState == ProcessingState.buffering;
  bool get canControl => _ready && !loading && error == null;
  String get status => error != null
      ? error!
      : loading
      ? '正在加载音频…'
      : buffering
      ? '正在缓冲…'
      : completed
      ? '已播放完毕'
      : playing
      ? '正在播放'
      : '已暂停';
  bool _current(int revision) => !_disposed && _revision == revision;
  void _notify() {
    if (!_disposed) notifyListeners();
  }

  Future<void> _persist({bool force = false}) {
    final current = _episode;
    if (!_ready || current == null) return _writes;
    final at = completed ? duration : (_engine?.position ?? position);
    if (!force &&
        _lastSaved != null &&
        (at - _lastSaved!).abs().inSeconds < 10) {
      return _writes;
    }
    _lastSaved = at;
    final url = current.url.toString();
    _writes = _writes
        .then((_) => prefs.savePlaybackPosition(url, at.inSeconds))
        .catchError((Object _) {});
    return _writes;
  }

  Future<void> _stopQuietly(PodcastAudioEngine? engine) async {
    try {
      await engine?.stop();
    } catch (_) {
      /* Best effort during interruption. */
    }
  }

  Future<void> _retireEngine() async {
    for (final sub in _subscriptions) {
      await sub.cancel();
    }
    _subscriptions.clear();
    final previous = _engine;
    _engine = null;
    try {
      await previous?.dispose();
    } catch (_) {
      /* New session may still start. */
    }
  }

  Future<void> start(PodcastEpisode next, {bool forceReload = false}) {
    if (_disposed) return Future.value();
    if (!forceReload && _episode?.url == next.url && error == null) {
      if (loading) return _transitions;
      return play(); // Opening the same episode never reloads its source.
    }
    final saved = _persist(
      force: true,
    ); // Capture the OLD episode before switching.
    final revision = ++_revision;
    final oldEngine = _engine;
    _episode = next;
    loading = true;
    _ready = false;
    resumed = false;
    position = Duration.zero;
    duration = Duration.zero;
    error = null;
    _lastSaved = null;
    _state = PlayerState(false, ProcessingState.loading);
    _notify();
    // Interrupt a slow setUrl so a newer selection doesn't wait for its timeout.
    unawaited(_stopQuietly(oldEngine));
    final operation = _transitions.then((_) async {
      await saved;
      await _retireEngine();
      if (!_current(revision)) return;
      PodcastAudioEngine? engine;
      try {
        if (!['http', 'https'].contains(next.url.scheme) ||
            next.url.host.isEmpty) {
          throw const FormatException('Invalid audio URL');
        }
        final seconds =
            int.tryParse(
              await prefs.loadPlaybackPosition(next.url.toString()) ?? '',
            ) ??
            0;
        if (!_current(revision)) return;
        engine = _engineFactory();
        final active = engine;
        _engine = active;
        _subscriptions.add(
          active.states.listen(
            (state) {
              if (!_current(revision)) return;
              _state = state;
              if (_ready && completed) unawaited(_persist(force: true));
              _notify();
            },
            onError: (Object _) {
              if (_current(revision)) {
                error = '播放中断，请重试';
                _notify();
              }
            },
          ),
        );
        _subscriptions.add(
          active.positions.listen((value) {
            if (!_current(revision)) return;
            position = value;
            if (_ready) unawaited(_persist());
            _notify();
          }, onError: (Object _) {}),
        );
        _subscriptions.add(
          active.durations.listen((value) {
            if (_current(revision)) {
              duration = value ?? Duration.zero;
              _notify();
            }
          }, onError: (Object _) {}),
        );
        final initial = seconds >= 30
            ? Duration(seconds: seconds)
            : Duration.zero;
        final total = await active.load(next.url, initial).timeout(loadTimeout);
        if (!_current(revision)) return;
        duration = total ?? Duration.zero;
        if (total != null &&
            initial > Duration.zero &&
            total - initial < const Duration(seconds: 10)) {
          await active.seek(Duration.zero);
        } else {
          resumed = initial > Duration.zero;
        }
        if (!_current(revision)) return;
        await active.setSpeed(speed);
        if (!_current(revision)) return;
        _ready = true;
        loading = false;
        position = active.position;
        _state = PlayerState(false, ProcessingState.ready);
        _notify();
        unawaited(play());
      } catch (_) {
        if (_current(revision)) {
          await _retireEngine();
          if (!_current(revision)) return;
          loading = false;
          _ready = false;
          error = '音频暂时无法加载，点此重试';
          _notify();
        }
      }
    });
    _transitions = operation.catchError((Object _) {});
    return operation;
  }

  Future<void> retry() {
    final current = _episode;
    return current == null ? Future.value() : start(current, forceReload: true);
  }

  Future<void> play() async {
    final active = _engine;
    final revision = _revision;
    if (!canControl || active == null || _disposed || playing) return;
    try {
      if (completed) await active.seek(Duration.zero);
      if (!_current(revision)) return;
      // just_audio.play completes when paused/stopped; don't block UI on it.
      unawaited(
        active.play().catchError((Object _) {
          if (_current(revision)) {
            error = '播放中断，请重试';
            _notify();
          }
        }),
      );
    } catch (_) {
      if (_current(revision)) {
        error = '播放中断，请重试';
        _notify();
      }
    }
  }

  Future<void> pause() async {
    final active = _engine;
    final revision = _revision;
    if (active == null || !canControl || _disposed) return;
    try {
      await active.pause();
      if (!_current(revision)) return;
      await _persist(force: true);
      _notify();
    } catch (_) {
      if (_current(revision)) {
        error = '暂时无法暂停，请关闭播放条';
        _notify();
      }
    }
  }

  Future<void> toggle() => playing
      ? pause()
      : error != null
      ? retry()
      : play();

  Future<void> seek(Duration target) async {
    final active = _engine;
    final revision = _revision;
    if (!canControl || active == null || duration <= Duration.zero) return;
    try {
      final clamped = Duration(
        milliseconds: target.inMilliseconds.clamp(0, duration.inMilliseconds),
      );
      await active.seek(clamped);
      if (!_current(revision)) return;
      position = clamped;
      await _persist(force: true);
      _notify();
    } catch (_) {
      if (_current(revision)) {
        error = '跳转失败，请重试';
        _notify();
      }
    }
  }

  Future<void> setSpeed(double value) async {
    final active = _engine;
    final revision = _revision;
    if (!canControl || active == null) throw StateError('Audio is not ready');
    await active.setSpeed(value);
    if (_current(revision)) {
      speed = value;
      _notify();
    }
  }

  Future<void> close() {
    final saved = _persist(force: true);
    ++_revision;
    _episode = null;
    loading = false;
    _ready = false;
    error = null;
    _notify();
    unawaited(_stopQuietly(_engine));
    final operation = _transitions.then((_) async {
      await saved;
      await _retireEngine();
    });
    _transitions = operation.catchError((Object _) {});
    return operation;
  }

  /// A loading session is closed when the app leaves the foreground so an
  /// async load cannot start playback later while the app is suspended.
  Future<void> suspend() => loading ? close() : pause();

  @override
  void dispose() {
    unawaited(close());
    _disposed = true;
    super.dispose();
  }
}
