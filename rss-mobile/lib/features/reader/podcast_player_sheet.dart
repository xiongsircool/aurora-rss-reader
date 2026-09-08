import 'dart:async';

import 'package:just_audio/just_audio.dart';
import 'package:flutter/material.dart';

import '../../data/repositories/reader_prefs_repository.dart';

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
  final ReaderPrefsRepository? prefs;

  static Future<void> show(
    BuildContext context, {
    required String title,
    required String feedTitle,
    required Uri url,
    ReaderPrefsRepository? prefs,
  }) => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => PodcastPlayerSheet(
      title: title,
      feedTitle: feedTitle,
      url: url,
      prefs: prefs,
    ),
  );

  @override
  State<PodcastPlayerSheet> createState() => _PodcastPlayerSheetState();
}

class _PodcastPlayerSheetState extends State<PodcastPlayerSheet> {
  final _player = AudioPlayer();
  final List<StreamSubscription<dynamic>> _subscriptions = [];
  PlayerState _state = PlayerState(false, ProcessingState.idle);
  Duration _duration = Duration.zero;
  Duration _position = Duration.zero;
  Duration? _lastSaved;
  double _speed = 1;
  bool _loading = true;
  bool _ready = false;
  bool _resumed = false;
  String? _error;
  Future<void> _saveTail = Future.value();

  @override
  void initState() {
    super.initState();
    _subscriptions.add(
      _player.playerStateStream.listen((state) {
        if (!mounted) return;
        setState(() => _state = state);
        if (_ready && state.processingState == ProcessingState.completed) {
          _save(_duration, force: true);
        }
      }),
    );
    _subscriptions.add(
      _player.durationStream.listen((duration) {
        if (mounted) setState(() => _duration = duration ?? Duration.zero);
      }),
    );
    _subscriptions.add(
      _player.positionStream.listen((position) {
        if (!mounted) return;
        setState(() => _position = position);
        if (_ready) _save(position);
      }),
    );
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _ready = false;
      _error = null;
      _resumed = false;
    });
    try {
      final saved =
          int.tryParse(
            await widget.prefs?.loadPlaybackPosition(widget.url.toString()) ??
                '',
          ) ??
          0;
      if (!mounted) return;
      final duration = await _player.setUrl(widget.url.toString());
      if (!mounted) return;
      if (saved >= 30 &&
          (duration == null || duration.inSeconds - saved > 60)) {
        await _player.seek(Duration(seconds: saved));
        if (!mounted) return;
        _resumed = true;
      }
      _ready = true;
    } catch (_) {
      if (mounted) _error = '音频暂时无法加载，请检查网络后重试';
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _save(Duration position, {bool force = false}) {
    final prefs = widget.prefs;
    if (prefs == null || !_ready) return;
    if (!force &&
        _lastSaved != null &&
        (position - _lastSaved!).abs().inSeconds < 10) {
      return;
    }
    _lastSaved = position;
    final audioUrl = widget.url.toString();
    _saveTail = _saveTail
        .then((_) => prefs.savePlaybackPosition(audioUrl, position.inSeconds))
        .catchError((Object _) {});
  }

  Future<void> _toggle() async {
    try {
      if (_player.playing) {
        await _player.pause();
        _save(_player.position, force: true);
      } else {
        if (_state.processingState == ProcessingState.completed) {
          await _player.seek(Duration.zero);
        }
        if (!mounted) return;
        await _player.play();
      }
    } catch (_) {
      if (mounted) setState(() => _error = '播放中断，请重试');
    }
  }

  Future<void> _seek(Duration target) async {
    try {
      await _player.seek(
        Duration(
          milliseconds: target.inMilliseconds.clamp(
            0,
            _duration.inMilliseconds,
          ),
        ),
      );
      _save(_player.position, force: true);
    } catch (_) {
      if (mounted) setState(() => _error = '跳转失败，请重试');
    }
  }

  Future<void> _setSpeed(double speed) async {
    try {
      await _player.setSpeed(speed);
      if (mounted) setState(() => _speed = speed);
    } catch (_) {
      if (mounted) setState(() => _error = '暂时无法调整倍速');
    }
  }

  @override
  void dispose() {
    _save(_player.position, force: true);
    for (final sub in _subscriptions) {
      sub.cancel();
    }
    _player.dispose();
    super.dispose();
  }

  String _time(Duration duration) {
    final s = duration.inSeconds.remainder(60).toString().padLeft(2, '0');
    final m = duration.inMinutes.remainder(60).toString().padLeft(2, '0');
    return duration.inHours > 0
        ? '${duration.inHours}:$m:$s'
        : '${duration.inMinutes}:$s';
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final buffering = _state.processingState == ProcessingState.buffering;
    final completed = _state.processingState == ProcessingState.completed;
    final playable = _ready && !_loading && _error == null;
    final status = _loading
        ? '正在加载音频…'
        : _error != null
        ? '播放暂不可用'
        : buffering
        ? '正在缓冲…'
        : completed
        ? '已播放完毕'
        : _state.playing
        ? '正在播放'
        : '已暂停';
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        24,
        0,
        24,
        24 + MediaQuery.paddingOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            widget.feedTitle,
            style: Theme.of(context).textTheme.labelLarge
                ?.copyWith(color: scheme.secondary),
          ),
          const SizedBox(height: 8),
          Text(
            widget.title,
            maxLines: 4,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleLarge
                ?.copyWith(height: 1.35),
          ),
          const SizedBox(height: 16),
          Text(status, style: Theme.of(context).textTheme.bodySmall),
          if (_resumed && !completed) const Text('已恢复到上次播放位置'),
          if (_loading || buffering)
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: LinearProgressIndicator(minHeight: 2),
            ),
          if (_error != null) ...[
            Text(_error!, style: TextStyle(color: scheme.error)),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: _loading ? null : _load,
                icon: const Icon(Icons.refresh),
                label: const Text('重新加载'),
              ),
            ),
          ],
          const SizedBox(height: 16),
          Slider(
            value: _duration.inMilliseconds > 0
                ? (_position.inMilliseconds / _duration.inMilliseconds).clamp(
                    0,
                    1,
                  )
                : 0,
            onChanged: playable && _duration > Duration.zero
                ? (value) => _seek(
                    Duration(
                      milliseconds: (value * _duration.inMilliseconds).round(),
                    ),
                  )
                : null,
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(_time(_position)),
              Text(_duration > Duration.zero ? _time(_duration) : '--:--'),
            ],
          ),
          const SizedBox(height: 20),
          Wrap(
            alignment: WrapAlignment.center,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 24,
            children: [
              IconButton(
                tooltip: '后退 10 秒',
                onPressed: playable
                    ? () => _seek(_position - const Duration(seconds: 10))
                    : null,
                icon: const Icon(Icons.replay_10),
                iconSize: 30,
              ),
              FilledButton(
                onPressed: playable ? _toggle : null,
                style: FilledButton.styleFrom(
                  shape: const CircleBorder(),
                  minimumSize: const Size(64, 64),
                ),
                child: Icon(
                  completed
                      ? Icons.replay
                      : _state.playing
                      ? Icons.pause
                      : Icons.play_arrow,
                  semanticLabel: completed
                      ? '重新播放'
                      : _state.playing
                      ? '暂停'
                      : '播放',
                  size: 32,
                ),
              ),
              IconButton(
                tooltip: '前进 30 秒',
                onPressed: playable
                    ? () => _seek(_position + const Duration(seconds: 30))
                    : null,
                icon: const Icon(Icons.forward_30),
                iconSize: 30,
              ),
            ],
          ),
          const SizedBox(height: 16),
          Center(
            child: PopupMenuButton<double>(
              tooltip: '播放速度',
              enabled: playable,
              onSelected: _setSpeed,
              itemBuilder: (_) => [
                for (final speed in [0.75, 1.0, 1.25, 1.5, 1.75, 2.0])
                  CheckedPopupMenuItem(
                    value: speed,
                    checked: _speed == speed,
                    child: Text('$speed×'),
                  ),
              ],
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  '$_speed× 播放速度',
                  style: TextStyle(
                    color: scheme.secondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
