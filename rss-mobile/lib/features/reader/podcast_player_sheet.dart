import 'dart:async';

import 'package:just_audio/just_audio.dart';
import 'package:flutter/material.dart';

import '../../data/repositories/reader_prefs_repository.dart';

/// Full-featured audio player for podcast entries.
/// Supports play/pause, seek, speed control, and position memory.
class PodcastPlayerSheet extends StatefulWidget {
  const PodcastPlayerSheet({
    required this.title,
    required this.feedTitle,
    required this.url,
    this.prefs,
    super.key,
  });

  final String title;
  final String feedTitle;
  final Uri url;

  /// Optional persistence for play position memory. When null the
  /// player works the same but does not remember progress.
  final ReaderPrefsRepository? prefs;

  static Future<void> show(
    BuildContext context, {
    required String title,
    required String feedTitle,
    required Uri url,
    ReaderPrefsRepository? prefs,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => PodcastPlayerSheet(
        title: title,
        feedTitle: feedTitle,
        url: url,
        prefs: prefs,
      ),
    );
  }

  @override
  State<PodcastPlayerSheet> createState() => _PodcastPlayerSheetState();
}

class _PodcastPlayerSheetState extends State<PodcastPlayerSheet> {
  late final AudioPlayer _player;
  PlayerState? _playerState;
  Duration? _duration;
  Duration? _position;
  double _speed = 1.0;
  String? _error;
  bool _disposed = false;
  Duration? _lastSavedPosition;
  bool _resumed = false;
  ReaderPrefsRepository? get _prefs => widget.prefs;

  @override
  void initState() {
    super.initState();
    _player = AudioPlayer();
    _init();
  }

  Future<void> _init() async {
    try {
      _playerState = PlayerState(false, ProcessingState.idle);

      _player.playerStateStream.listen((state) {
        if (_disposed) return;
        setState(() => _playerState = state);
      });

      _player.durationStream.listen((duration) {
        if (_disposed) return;
        setState(() => _duration = duration);
      });

      _player.positionStream.listen((position) {
        if (_disposed) return;
        setState(() => _position = position);
        _maybeSaveProgress(position);
      });

      await _player.setUrl(widget.url.toString());
      await _restoreProgress();
    } catch (e) {
      if (_disposed) return;
      setState(() => _error = '加载音频失败：$e');
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _player.dispose();
    super.dispose();
  }

  Future<void> _toggle() async {
    if (_player.playing) {
      await _player.pause();
    } else {
      await _player.play();
    }
  }

  Future<void> _seek(Duration position) async {
    await _player.seek(position);
  }

  Future<void> _skip(Duration delta) async {
    final current = _position ?? Duration.zero;
    final target = current + delta;
    await _seek(target);
  }

  /// Resumes playback from the last saved position (if meaningful).
  Future<void> _restoreProgress() async {
    final prefs = _prefs;
    if (prefs == null) return;
    final seconds = double.tryParse(
      await prefs.loadPlaybackPosition(widget.url.toString()) ?? '',
    );
    if (seconds == null || seconds < 30) return;
    final saved = Duration(seconds: seconds.round());
    final duration = _player.duration;
    if (duration != null && duration - saved < const Duration(seconds: 60)) {
      return; // essentially finished; start over
    }
    await _player.seek(saved);
    if (_disposed) return;
    setState(() {
      _position = saved;
      _resumed = true;
    });
  }

  /// Persists progress at most every 10 seconds of new playback.
  void _maybeSaveProgress(Duration position) {
    final prefs = _prefs;
    if (prefs == null) return;
    final last = _lastSavedPosition;
    if (last != null && (position - last).abs() < const Duration(seconds: 10)) {
      return;
    }
    _lastSavedPosition = position;
    prefs.savePlaybackPosition(widget.url.toString(), position.inSeconds);
  }

  void _cycleSpeed() {
    const speeds = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    final nextIndex = (speeds.indexOf(_speed) + 1) % speeds.length;
    _speed = speeds[nextIndex];
    _player.setSpeed(_speed);
    setState(() {});
  }

  String _formatDuration(Duration? d) {
    if (d == null) return '--:--';
    final hours = d.inHours;
    final minutes = d.inMinutes.remainder(60);
    final seconds = d.inSeconds.remainder(60);
    if (hours > 0) {
      return '$hours:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
    }
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final isPlaying = _playerState?.playing ?? false;
    final position = _position ?? Duration.zero;
    final duration = _duration ?? Duration.zero;
    final progress = duration.inMilliseconds > 0
        ? position.inMilliseconds / duration.inMilliseconds
        : 0.0;

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title
          Text(
            widget.title,
            style: Theme.of(context).textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.w600),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Text(
            widget.feedTitle,
            style: Theme.of(context).textTheme.bodySmall
                ?.copyWith(color: colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 24),

          if (_resumed) ...[
            Text(
              '已恢复到上次播放位置',
              style: Theme.of(context).textTheme.labelSmall
                  ?.copyWith(color: colorScheme.secondary),
            ),
            const SizedBox(height: 8),
          ],

          if (_error != null) ...[
            Text(_error!, style: TextStyle(color: colorScheme.error)),
            const SizedBox(height: 16),
          ],

          // Progress bar
          Row(
            children: [
              Text(
                _formatDuration(position),
                style: Theme.of(context).textTheme.labelSmall
                    ?.copyWith(color: colorScheme.onSurfaceVariant),
              ),
              Expanded(
                child: SliderTheme(
                  data: SliderThemeData(
                    trackHeight: 4,
                    thumbShape: const RoundSliderThumbShape(
                      enabledThumbRadius: 6,
                    ),
                    overlayShape: const RoundSliderOverlayShape(
                      overlayRadius: 12,
                    ),
                  ),
                  child: Slider(
                    value: progress.clamp(0.0, 1.0),
                    onChanged: (value) {
                      final target = Duration(
                        milliseconds: (value * duration.inMilliseconds).toInt(),
                      );
                      _seek(target);
                    },
                  ),
                ),
              ),
              Text(
                _formatDuration(duration),
                style: Theme.of(context).textTheme.labelSmall
                    ?.copyWith(color: colorScheme.onSurfaceVariant),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Controls
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Skip back 15s
              IconButton(
                onPressed: () => _skip(const Duration(seconds: -15)),
                icon: const Icon(Icons.replay_10),
                iconSize: 32,
                color: colorScheme.onSurfaceVariant,
              ),
              const SizedBox(width: 24),

              // Play/Pause
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: colorScheme.primary,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: colorScheme.primary.withValues(alpha: 0.3),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: IconButton(
                  onPressed: _error != null ? null : _toggle,
                  icon: Icon(
                    isPlaying ? Icons.pause : Icons.play_arrow,
                    color: colorScheme.onPrimary,
                    size: 36,
                  ),
                ),
              ),
              const SizedBox(width: 24),

              // Skip forward 30s
              IconButton(
                onPressed: () => _skip(const Duration(seconds: 30)),
                icon: const Icon(Icons.forward_30),
                iconSize: 32,
                color: colorScheme.onSurfaceVariant,
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Speed control
          Center(
            child: TextButton(
              onPressed: _cycleSpeed,
              child: Text(
                '${_speed.toStringAsFixed(_speed == _speed.truncateToDouble() ? 1 : 2)}x',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: colorScheme.secondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
