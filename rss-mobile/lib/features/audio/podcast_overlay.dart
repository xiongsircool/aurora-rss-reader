import 'dart:async';
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../reader/podcast_player_sheet.dart';
import 'podcast_controller.dart';

/// Tracks which navigator page is visible, hiding the mini player above
/// modal dialogs/sheets rather than intercepting their touches.
class PodcastRouteObserver extends NavigatorObserver with ChangeNotifier {
  final List<Route<dynamic>> _routes = [];
  bool _disposed = false;
  bool get pageVisible => _routes.isNotEmpty && _routes.last is PageRoute;
  bool get onHome => _routes.length == 1;
  void _changed() => WidgetsBinding.instance.addPostFrameCallback((_) {
    if (!_disposed) notifyListeners();
  });
  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _routes.add(route);
    _changed();
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _routes.remove(route);
    _changed();
  }

  @override
  void didRemove(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _routes.remove(route);
    _changed();
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    final index = _routes.indexWhere((route) => route == oldRoute);
    if (index >= 0) {
      if (newRoute == null) {
        _routes.removeAt(index);
      } else {
        _routes[index] = newRoute;
      }
    }
    _changed();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}

class PodcastInsets extends InheritedWidget {
  const PodcastInsets({
    required this.extraBottom,
    required super.child,
    super.key,
  });
  final double extraBottom;
  static double of(BuildContext context) =>
      context
          .dependOnInheritedWidgetOfExactType<PodcastInsets>()
          ?.extraBottom ??
      0;
  @override
  bool updateShouldNotify(PodcastInsets oldWidget) =>
      extraBottom != oldWidget.extraBottom;
}

/// One mini-player above all page routes, positioned above the capsule on the
/// compact home screen and at the page bottom elsewhere. No audio lives here.
class PodcastOverlayHost extends StatefulWidget {
  const PodcastOverlayHost({
    required this.controller,
    required this.observer,
    required this.navigatorKey,
    required this.child,
    super.key,
  });
  final PodcastController controller;
  final PodcastRouteObserver observer;
  final GlobalKey<NavigatorState> navigatorKey;
  final Widget child;
  @override
  State<PodcastOverlayHost> createState() => _PodcastOverlayHostState();
}

class _PodcastOverlayHostState extends State<PodcastOverlayHost> {
  late final AppLifecycleListener _lifecycle;
  @override
  void initState() {
    super.initState();
    _lifecycle = AppLifecycleListener(
      onPause: () => unawaited(widget.controller.suspend()),
    );
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    super.dispose();
  }

  void _expand() {
    final context = widget.navigatorKey.currentState?.overlay?.context;
    if (context != null) {
      PodcastPlayerSheet.show(context, controller: widget.controller);
    }
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: Listenable.merge([widget.controller, widget.observer]),
    builder: (context, _) {
      final player = widget.controller;
      final episode = player.episode;
      final width = MediaQuery.sizeOf(context).width;
      final scaler = MediaQuery.textScalerOf(context);
      final height = math.max(52.0, scaler.scale(13) * 1.4 + 22);
      final maxWidth = math.min(width - 32, 480.0);
      final navHeight = (48 + scaler.scale(11)).clamp(62.0, 120.0);
      final compactHome = widget.observer.onHome && width < 700;
      final bottom =
          MediaQuery.viewPaddingOf(context).bottom +
          (compactHome ? navHeight + 12 : 12);
      return PodcastInsets(
        extraBottom: episode == null ? 0 : height + 12,
        child: Stack(
          children: [
            Positioned.fill(child: widget.child),
            if (episode != null &&
                widget.observer.pageVisible &&
                MediaQuery.viewInsetsOf(context).bottom == 0)
              Positioned(
                right: 16,
                bottom: bottom,
                width: maxWidth,
                height: height,
                child: Material(
                  elevation: 3,
                  color: Theme.of(context).colorScheme.surfaceContainerHigh,
                  borderRadius: BorderRadius.circular(height / 2),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    key: const ValueKey('mini-player-open'),
                    onTap: _expand,
                    child: Row(
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(left: 8),
                          child: _MiniCover(
                            episode: episode,
                            size: height - 14,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Flexible(
                                child: Text(
                                  episode.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context).textTheme.labelLarge
                                      ?.copyWith(fontWeight: FontWeight.w600),
                                ),
                              ),
                              const SizedBox(height: 1),
                              Flexible(child: _MiniProgress(player: player)),
                            ],
                          ),
                        ),
                        IconButton(
                          key: const ValueKey('mini-player-toggle'),
                          visualDensity: VisualDensity.compact,
                          constraints: BoxConstraints(
                            minWidth: 40,
                            minHeight: height - 8,
                          ),
                          padding: EdgeInsets.zero,
                          onPressed: player.loading ? null : player.toggle,
                          icon: Icon(
                            player.error != null
                                ? Icons.refresh
                                : player.completed
                                ? Icons.replay
                                : player.playing
                                ? Icons.pause
                                : Icons.play_arrow,
                            size: 22,
                            semanticLabel: player.error != null
                                ? '重试音频'
                                : player.playing
                                ? '暂停音频'
                                : '播放音频',
                          ),
                        ),
                        IconButton(
                          key: const ValueKey('mini-player-close'),
                          visualDensity: VisualDensity.compact,
                          constraints: BoxConstraints(
                            minWidth: 36,
                            minHeight: height - 8,
                          ),
                          padding: EdgeInsets.zero,
                          onPressed: player.close,
                          icon: const Icon(
                            Icons.close,
                            size: 18,
                            semanticLabel: '停止播放并关闭',
                          ),
                        ),
                        const SizedBox(width: 4),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      );
    },
  );
}

final class _MiniCover extends StatelessWidget {
  const _MiniCover({required this.episode, required this.size});
  final PodcastEpisode episode;
  final double size;
  @override
  Widget build(BuildContext context) {
    final cover = episode.cover;
    return ClipRRect(
      borderRadius: BorderRadius.circular(size / 3),
      child: cover == null
          ? SizedBox(
              width: size,
              height: size,
              child: const Icon(Icons.headphones_outlined, size: 20),
            )
          : CachedNetworkImage(
              imageUrl: cover.toString(),
              width: size,
              height: size,
              fit: BoxFit.cover,
              placeholder: (_, _) => SizedBox(
                width: size,
                height: size,
                child: const Icon(Icons.headphones_outlined, size: 20),
              ),
              errorWidget: (_, _, _) => SizedBox(
                width: size,
                height: size,
                child: const Icon(Icons.headphones_outlined, size: 20),
              ),
            ),
    );
  }
}

final class _MiniProgress extends StatelessWidget {
  const _MiniProgress({required this.player});
  final PodcastController player;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final failed = player.error != null;
    final value = player.loading || player.buffering
        ? null
        : player.duration.inMilliseconds > 0
        ? (player.position.inMilliseconds / player.duration.inMilliseconds)
              .clamp(0.0, 1.0)
        : 0.0;
    return Row(
      children: [
        Flexible(
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              player.completed
                  ? '已播完'
                  : '${formatPodcastTime(player.position)} / ${player.duration > Duration.zero ? formatPodcastTime(player.duration) : '--:--'}',
              maxLines: 1,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: failed ? scheme.error : scheme.onSurfaceVariant,
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: LinearProgressIndicator(
            minHeight: 2,
            borderRadius: BorderRadius.circular(2),
            value: value,
            color: failed ? scheme.error : scheme.secondary,
            backgroundColor: scheme.onSurfaceVariant.withValues(alpha: 0.2),
          ),
        ),
      ],
    );
  }
}
