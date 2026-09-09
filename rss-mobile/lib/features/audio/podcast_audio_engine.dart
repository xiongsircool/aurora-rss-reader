import 'package:just_audio/just_audio.dart';

/// Narrow audio adapter, allowing session/lifecycle logic to be tested without
/// platform audio or network access.
abstract interface class PodcastAudioEngine {
  Stream<PlayerState> get states;
  Stream<Duration> get positions;
  Stream<Duration?> get durations;
  Duration get position;
  Future<Duration?> load(Uri url, Duration initialPosition);
  Future<void> play();
  Future<void> pause();
  Future<void> seek(Duration position);
  Future<void> setSpeed(double speed);
  Future<void> stop();
  Future<void> dispose();
}

class JustAudioPodcastEngine implements PodcastAudioEngine {
  final _player = AudioPlayer();
  @override
  Stream<PlayerState> get states => _player.playerStateStream;
  @override
  Stream<Duration> get positions => _player.positionStream;
  @override
  Stream<Duration?> get durations => _player.durationStream;
  @override
  Duration get position => _player.position;
  @override
  Future<Duration?> load(Uri url, Duration initialPosition) =>
      _player.setUrl(url.toString(), initialPosition: initialPosition);
  @override
  Future<void> play() => _player.play();
  @override
  Future<void> pause() => _player.pause();
  @override
  Future<void> seek(Duration position) => _player.seek(position);
  @override
  Future<void> setSpeed(double speed) => _player.setSpeed(speed);
  @override
  Future<void> stop() => _player.stop();
  @override
  Future<void> dispose() => _player.dispose();
}
