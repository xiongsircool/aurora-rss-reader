import 'package:flutter/material.dart';

import '../../shared/choice_sheet.dart';
import '../audio/podcast_controller.dart';

String formatPodcastTime(Duration duration) {
  final seconds = duration.inSeconds.remainder(60).toString().padLeft(2, '0');
  final minutes = duration.inMinutes.remainder(60).toString().padLeft(2, '0');
  return duration.inHours > 0
      ? '${duration.inHours}:$minutes:$seconds'
      : '${duration.inMinutes}:$seconds';
}

/// Expanded controls for the shared session. Dismissing this sheet never
/// stops playback and never creates or disposes an AudioPlayer.
class PodcastPlayerSheet extends StatefulWidget {
  const PodcastPlayerSheet({required this.controller, super.key});
  final PodcastController controller;

  static Future<void> show(
    BuildContext context, {
    required PodcastController controller,
  }) => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    routeSettings: const RouteSettings(name: 'podcast-controls'),
    builder: (_) => PodcastPlayerSheet(controller: controller),
  );

  @override
  State<PodcastPlayerSheet> createState() => _PodcastPlayerSheetState();
}

class _PodcastPlayerSheetState extends State<PodcastPlayerSheet> {
  double? _seekFraction;
  Uri? _dragEpisode;

  Future<void> _speed() async {
    await showChoiceSheet<double>(
      context: context,
      title: '播放速度',
      selected: widget.controller.speed,
      options: [
        for (final value in [0.75, 1.0, 1.25, 1.5, 1.75, 2.0])
          ChoiceOption(
            value: value,
            title: '$value×',
            subtitle: value == 1 ? '正常速度' : null,
          ),
      ],
      onApply: widget.controller.setSpeed,
    );
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, _) {
      final player = widget.controller;
      final episode = player.episode;
      if (episode == null) return const SizedBox.shrink();
      final scheme = Theme.of(context).colorScheme;
      final fraction = _dragEpisode == episode.url ? _seekFraction : null;
      final displayed = fraction == null
          ? player.position
          : Duration(
              milliseconds: (fraction * player.duration.inMilliseconds).round(),
            );
      final canSeek = player.canControl && player.duration > Duration.zero;
      final progress =
          fraction ??
          (player.duration.inMilliseconds > 0
              ? (player.position.inMilliseconds /
                        player.duration.inMilliseconds)
                    .clamp(0.0, 1.0)
              : 0.0);
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
            Row(
              children: [
                Expanded(
                  child: Text(
                    episode.feedTitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelLarge
                        ?.copyWith(color: scheme.secondary),
                  ),
                ),
                IconButton(
                  tooltip: '收起播放器，继续播放',
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.keyboard_arrow_down),
                ),
              ],
            ),
            Text(
              episode.title,
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleLarge
                  ?.copyWith(height: 1.35),
            ),
            const SizedBox(height: 12),
            Text(
              player.status,
              style: TextStyle(
                color: player.error == null
                    ? scheme.onSurfaceVariant
                    : scheme.error,
              ),
            ),
            if (player.resumed && player.error == null && !player.completed)
              const Text('已恢复上次进度'),
            if (player.loading || player.buffering)
              const Padding(
                padding: EdgeInsets.only(top: 12),
                child: LinearProgressIndicator(minHeight: 2),
              ),
            if (player.error != null)
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: player.loading ? null : player.retry,
                  icon: const Icon(Icons.refresh),
                  label: const Text('重新加载'),
                ),
              ),
            const SizedBox(height: 16),
            Slider(
              key: const ValueKey('podcast-seek'),
              value: progress,
              onChanged: canSeek
                  ? (value) => setState(() {
                      _dragEpisode = episode.url;
                      _seekFraction = value;
                    })
                  : null,
              onChangeEnd: canSeek
                  ? (value) {
                      final sameEpisode = _dragEpisode == player.episode?.url;
                      setState(() => _seekFraction = null);
                      if (sameEpisode) {
                        player.seek(
                          Duration(
                            milliseconds:
                                (value * player.duration.inMilliseconds)
                                    .round(),
                          ),
                        );
                      }
                    }
                  : null,
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(formatPodcastTime(displayed)),
                Text(
                  player.duration > Duration.zero
                      ? formatPodcastTime(player.duration)
                      : '--:--',
                ),
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
                  iconSize: 30,
                  icon: const Icon(Icons.replay_10),
                  onPressed: canSeek
                      ? () => player.seek(
                          player.position - const Duration(seconds: 10),
                        )
                      : null,
                ),
                FilledButton(
                  onPressed: player.canControl ? player.toggle : null,
                  style: FilledButton.styleFrom(
                    shape: const CircleBorder(),
                    minimumSize: const Size(64, 64),
                  ),
                  child: Icon(
                    player.completed
                        ? Icons.replay
                        : player.playing
                        ? Icons.pause
                        : Icons.play_arrow,
                    semanticLabel: player.completed
                        ? '重新播放'
                        : player.playing
                        ? '暂停'
                        : '播放',
                    size: 32,
                  ),
                ),
                IconButton(
                  tooltip: '前进 30 秒',
                  iconSize: 30,
                  icon: const Icon(Icons.forward_30),
                  onPressed: canSeek
                      ? () => player.seek(
                          player.position + const Duration(seconds: 30),
                        )
                      : null,
                ),
              ],
            ),
            Center(
              child: TextButton.icon(
                onPressed: player.canControl ? _speed : null,
                icon: const Icon(Icons.speed),
                label: Text('${player.speed}× 播放速度'),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              '收起后可继续浏览文章。当前支持应用内持续播放，离开应用时会暂停。',
              textAlign: TextAlign.center,
            ),
            TextButton(
              onPressed: () {
                player.close();
                Navigator.pop(context);
              },
              child: const Text('停止播放并关闭'),
            ),
          ],
        ),
      );
    },
  );
}
