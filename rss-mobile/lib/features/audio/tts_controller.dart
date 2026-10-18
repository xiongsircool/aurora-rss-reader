import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';

import '../../domain/tts/sentence_splitter.dart';

enum TtsStatus { idle, speaking, paused, done }

/// Metadata about the entry being spoken, shown in the mini bar.
final class TtsEntryMeta {
  const TtsEntryMeta({
    required this.entryId,
    required this.title,
    required this.feedTitle,
  });

  final String entryId;
  final String title;
  final String feedTitle;
}

/// App-owned TTS session, mirroring [PodcastController]: views never
/// own the engine; leaving a page never stops playback.
final class TtsController extends ChangeNotifier {
  final FlutterTts _tts = FlutterTts();
  final List<String> _sentences = <String>[];

  TtsEntryMeta? entry;
  TtsStatus status = TtsStatus.idle;
  int sentenceIndex = 0;
  double speed = 1;

  /// Bumped on every stop/seek/start so stale speak loops die out.
  int _session = 0;
  bool _disposed = false;
  bool _engineReady = false;
  VoidCallback? onCompleted;

  List<String> get sentences => List.unmodifiable(_sentences);
  bool get active => status != TtsStatus.idle && entry != null;
  double get progress =>
      _sentences.isEmpty ? 0 : (sentenceIndex + 1) / _sentences.length;

  /// Maps a user-facing speed (0.75–2.0×) to a platform speech rate.
  /// iOS AVSpeech: 0.5 is normal, 1.0 the practical max; Android: 1.0
  /// is normal and accepts up to ~2.0.
  static double speechRateFor(String platform, double speed) {
    if (platform == 'ios') {
      return (0.5 * speed).clamp(0.1, 1.0);
    }
    return speed.clamp(0.5, 2.0);
  }

  Future<void> _ensureEngine(String language) async {
    if (_engineReady) return;
    await _tts.awaitSpeakCompletion(true);
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      await _tts.setIosAudioCategory(
        IosTextToSpeechAudioCategory.playback,
        [IosTextToSpeechAudioCategoryOptions.defaultToSpeaker],
      );
    }
    _engineReady = true;
  }

  /// Starts speaking [html] as segmented sentences. [startIndex] lets
  /// the reader begin near the current scroll position.
  Future<void> start({
    required TtsEntryMeta meta,
    required String html,
    required String language,
    int startIndex = 0,
    VoidCallback? onCompleted,
  }) async {
    await stopInternal();
    final sentences = splitIntoSentences(html);
    if (sentences.isEmpty) return;
    _sentences
      ..clear()
      ..addAll(sentences);
    entry = meta;
    this.onCompleted = onCompleted;
    sentenceIndex = startIndex.clamp(0, sentences.length - 1);

    final langCode = language.toLowerCase().startsWith('en')
        ? 'en-US'
        : 'zh-CN';
    await _ensureEngine(langCode);
    await _tts.setLanguage(langCode);
    await _applySpeed();

    _statusChanged(TtsStatus.speaking);
    await _speakFrom(sentenceIndex, _session);
  }

  Future<void> _speakFrom(int index, int session) async {
    while (!_disposed && session == _session && index < _sentences.length) {
      sentenceIndex = index;
      _notify();
      try {
        await _tts.speak(_sentences[index]);
      } catch (_) {
        // Engine hiccups (missing voice etc.) stop the session cleanly.
        await stopInternal();
        return;
      }
      if (_disposed || session != _session) return;
      if (status != TtsStatus.speaking) return; // paused by user
      index++;
    }
    if (_disposed || session != _session) return;
    sentenceIndex = _sentences.length - 1;
    _statusChanged(TtsStatus.done);
    onCompleted?.call();
  }

  Future<void> togglePlayPause() async {
    switch (status) {
      case TtsStatus.speaking:
        await pause();
      case TtsStatus.paused:
        await resume();
      case TtsStatus.idle:
      case TtsStatus.done:
        break;
    }
  }

  Future<void> pause() async {
    if (status != TtsStatus.speaking) return;
    // The pending speak() future stays alive; when resumed it resolves
    // as the sentence finishes and the loop continues naturally.
    await _tts.pause();
    _statusChanged(TtsStatus.paused);
  }

  Future<void> resume() async {
    if (status != TtsStatus.paused) return;
    // On iOS, speak() while paused == continueSpeaking(); no new loop.
    _statusChanged(TtsStatus.speaking);
    try {
      await _tts.speak('');
    } catch (_) {
      // Some Android engines do not treat speak("") as resume —
      // restart the current sentence instead.
      final session = ++_session;
      await _speakFrom(sentenceIndex, session);
    }
  }

  /// Jumps to [index] and continues speaking from there.
  Future<void> seekTo(int index) async {
    if (_sentences.isEmpty) return;
    final clamped = index.clamp(0, _sentences.length - 1);
    await _tts.stop();
    final session = ++_session;
    sentenceIndex = clamped;
    _statusChanged(TtsStatus.speaking);
    await _speakFrom(clamped, session);
  }

  Future<void> setSpeed(double value) async {
    speed = value;
    await _applySpeed();
    _notify();
  }

  Future<void> _applySpeed() async {
    await _tts.setSpeechRate(speechRateFor(
      defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
      speed,
    ));
  }

  /// Fully ends the session and clears the mini bar.
  Future<void> stopInternal() async {
    _session++;
    if (entry != null || status != TtsStatus.idle) {
      try {
        await _tts.stop();
      } catch (_) {}
    }
    _sentences.clear();
    entry = null;
    onCompleted = null;
    sentenceIndex = 0;
    _statusChanged(TtsStatus.idle);
  }

  void _statusChanged(TtsStatus value) {
    status = value;
    _notify();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _session++;
    try {
      unawaited(_tts.stop());
    } catch (_) {}
    super.dispose();
  }
}
