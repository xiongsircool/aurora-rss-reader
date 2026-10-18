// One global TTS mini bar above all page routes, stacked above the
// podcast mini bar when both are present. No TTS engine lives here.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../reader/tts_reading_page.dart';
import 'podcast_overlay.dart' show PodcastInsets, PodcastRouteObserver;
import 'tts_controller.dart';

/// One global TTS mini bar above all page routes, stacked above the
/// podcast mini bar when both are present. No TTS engine lives here.
class TtsOverlayHost extends StatelessWidget {
  const TtsOverlayHost({
    required this.controller,
    required this.observer,
    required this.navigatorKey,
    required this.child,
    super.key,
  });

  final TtsController controller;
  final PodcastRouteObserver observer;
  final GlobalKey<NavigatorState> navigatorKey;
  final Widget child;

  static const List<double> _speedSteps = [0.75, 1, 1.25, 1.5, 2];

  void _cycleSpeed() {
    final next = _speedSteps[(_speedSteps.indexOf(controller.speed) + 1) %
        _speedSteps.length];
    controller.setSpeed(next);
  }

  void _expand() {
    final context = navigatorKey.currentState?.overlay?.context;
    if (context != null) {
      Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => TtsReadingPage(controller: controller),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: Listenable.merge([controller, observer]),
    builder: (context, _) {
      final active =
          controller.active &&
          controller.status != TtsStatus.done &&
          observer.pageVisible &&
          MediaQuery.viewInsetsOf(context).bottom == 0;
      final scaler = MediaQuery.textScalerOf(context);
      final height = (scaler.scale(13) * 1.4 + 22).clamp(52.0, 72.0);
      final width = MediaQuery.sizeOf(context).width;
      final maxWidth = math.min(width - 32, 480.0);
      final podcastExtra = PodcastInsets.of(context);
      final navHeight = (48 + scaler.scale(11)).clamp(62.0, 120.0);
      final compactHome = observer.onHome && width < 700;
      final bottom =
          MediaQuery.viewPaddingOf(context).bottom +
          podcastExtra +
          (compactHome ? navHeight + 12 : 12);
      return Stack(
        children: [
          Positioned.fill(child: child),
          if (active)
            Positioned(
              key: const ValueKey('tts-mini-bar'),
              right: 16,
              bottom: bottom,
              width: maxWidth,
              height: height,
              child: Material(
                elevation: 3,
                color: Theme.of(context).colorScheme.secondaryContainer,
                borderRadius: BorderRadius.circular(height / 2),
                clipBehavior: Clip.antiAlias,
                child: Row(
                  children: [
                    IconButton(
                      key: const ValueKey('tts-mini-toggle'),
                      tooltip: controller.status == TtsStatus.speaking
                          ? '暂停朗读'
                          : '继续朗读',
                      icon: Icon(
                        controller.status == TtsStatus.speaking
                            ? Icons.pause_rounded
                            : Icons.play_arrow_rounded,
                      ),
                      onPressed: controller.togglePlayPause,
                    ),
                    Expanded(
                      child: GestureDetector(
                        onTap: _expand,
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${controller.sentenceIndex + 1}'
                              '/${controller.sentences.length}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(
                                    color: Theme.of(
                                      context,
                                    ).colorScheme.onSecondaryContainer,
                                  ),
                            ),
                            LinearProgressIndicator(
                              value: controller.progress,
                              minHeight: 2,
                              borderRadius: BorderRadius.circular(1),
                            ),
                          ],
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: _cycleSpeed,
                      child: Text('${controller.speed}x'),
                    ),
                    IconButton(
                      tooltip: '停止朗读',
                      icon: const Icon(Icons.close_rounded, size: 20),
                      onPressed: controller.stopInternal,
                    ),
                  ],
                ),
              ),
            ),
        ],
      );
    },
  );
}
