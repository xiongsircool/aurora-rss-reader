import 'dart:async';

import 'package:just_audio/just_audio.dart';
import 'package:aurora_mobile/features/audio/podcast_audio_engine.dart';

class FakePodcastEngine implements PodcastAudioEngine {
  final _states = StreamController<PlayerState>.broadcast(sync: true);
  final _positions = StreamController<Duration>.broadcast(sync: true);
  final _durations = StreamController<Duration?>.broadcast(sync: true);
  final loadStarted = Completer<void>();
  Completer<Duration?>? loadGate;
  Completer<void>? _playback;
  bool failLoad = false;
  bool disposed = false;
  bool playing = false;
  int plays = 0;
  int loads = 0;
  int pauses = 0;
  int stops = 0;
  final seeks = <Duration>[];
  Duration total = const Duration(minutes: 10);
  Duration initial = Duration.zero;
  @override
  Duration position = Duration.zero;
  @override
  Stream<PlayerState> get states => _states.stream;
  @override
  Stream<Duration> get positions => _positions.stream;
  @override
  Stream<Duration?> get durations => _durations.stream;
  @override
  Future<Duration?> load(Uri url, Duration initialPosition) async {
    loads++;
    initial = initialPosition;
    if (!loadStarted.isCompleted) loadStarted.complete();
    if (failLoad) throw StateError('load failed');
    if (loadGate != null) await loadGate!.future;
    position = initialPosition;
    _durations.add(total);
    _positions.add(position);
    _states.add(PlayerState(false, ProcessingState.ready));
    return total;
  }

  @override
  Future<void> play() {
    plays++;
    playing = true;
    _states.add(PlayerState(true, ProcessingState.ready));
    _playback ??= Completer<void>();
    return _playback!.future;
  }

  void advance(Duration at) {
    position = at;
    _positions.add(at);
  }

  void complete() {
    position = total;
    _positions.add(total);
    _states.add(PlayerState(true, ProcessingState.completed));
  }

  @override
  Future<void> pause() async {
    pauses++;
    playing = false;
    _playback?.complete();
    _playback = null;
    _states.add(PlayerState(false, ProcessingState.ready));
  }

  @override
  Future<void> seek(Duration at) async {
    seeks.add(at);
    position = at;
    _positions.add(at);
    _states.add(PlayerState(playing, ProcessingState.ready));
  }

  @override
  Future<void> setSpeed(double speed) async {}
  @override
  Future<void> stop() async {
    if (disposed) return;
    stops++;
    if (loadGate != null && !loadGate!.isCompleted) {
      loadGate!.completeError(StateError('interrupted'));
    }
    _playback?.complete();
    _playback = null;
    playing = false;
    _states.add(PlayerState(false, ProcessingState.idle));
  }

  @override
  Future<void> dispose() async {
    if (disposed) return;
    await stop();
    disposed = true;
    await _states.close();
    await _positions.close();
    await _durations.close();
  }
}
