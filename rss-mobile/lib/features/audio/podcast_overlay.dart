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
      final height = math.max(
        76.0,
        scaler.scale(14) * 1.4 + scaler.scale(11) * 1.4 + 22,
      );
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
                width: math.min(width - 32, 560),
                height: height,
                child: Material(
                  elevation: 4,
                  color: Theme.of(context).colorScheme.surfaceContainer,
                  borderRadius: BorderRadius.circular(16),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    key: const ValueKey('mini-player-open'),
                    onTap: _expand,
                    child: Column(
                      children: [
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.only(left: 14, right: 4),
                            child: Row(
                              children: [
                                if (width >= 380 && scaler.scale(14) < 22) ...[
                                  if (episode.cover != null)
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(8),
                                      child: CachedNetworkImage(
                                        imageUrl: episode.cover.toString(),
                                        width: 40,
                                        height: 40,
                                        fit: BoxFit.cover,
                                        placeholder: (_, _) => const Icon(
                                          Icons.headphones_outlined,
                                        ),
                                        errorWidget: (_, _, _) => const Icon(
                                          Icons.headphones_outlined,
                                        ),
                                      ),
                                    )
                                  else
                                    const Icon(
                                      Icons.headphones_outlined,
                                      size: 24,
                                    ),
                                  const SizedBox(width: 12),
                                ],
                                Expanded(
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        episode.title,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleSmall,
                                      ),
                                      const SizedBox(height: 3),
                                      Text(
                                        '${formatPodcastTime(player.position)} · ${player.status}',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: Theme.of(context)
                                            .textTheme
                                            .labelSmall
                                            ?.copyWith(
                                              color: player.error == null
                                                  ? Theme.of(context)
                                                        .colorScheme
                                                        .onSurfaceVariant
                                                  : Theme.of(context)
                                                        .colorScheme
                                                        .error,
                                            ),
                                      ),
                                    ],
                                  ),
                                ),
                                IconButton(
                                  key: const ValueKey('mini-player-toggle'),
                                  onPressed: player.loading
                                      ? null
                                      : player.toggle,
                                  icon: Icon(
                                    player.error != null
                                        ? Icons.refresh
                                        : player.completed
                                        ? Icons.replay
                                        : player.playing
                                        ? Icons.pause
                                        : Icons.play_arrow,
                                    semanticLabel: player.error != null
                                        ? '重试音频'
                                        : player.playing
                                        ? '暂停音频'
                                        : '播放音频',
                                  ),
                                ),
                                IconButton(
                                  key: const ValueKey('mini-player-close'),
                                  onPressed: player.close,
                                  icon: const Icon(
                                    Icons.close,
                                    size: 20,
                                    semanticLabel: '停止播放并关闭',
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        LinearProgressIndicator(
                          minHeight: 2,
                          value: player.loading || player.buffering
                              ? null
                              : player.duration.inMilliseconds > 0
                              ? (player.position.inMilliseconds /
                                        player.duration.inMilliseconds)
                                    .clamp(0.0, 1.0)
                              : 0,
                        ),
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
