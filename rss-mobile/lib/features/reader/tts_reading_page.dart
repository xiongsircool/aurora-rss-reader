import 'package:flutter/material.dart';

import '../audio/tts_controller.dart';

/// Immersive "listening & reading" view: one sentence per row, the
/// spoken sentence highlighted and kept centered; tap any sentence to
/// continue from there.
final class TtsReadingPage extends StatefulWidget {
  const TtsReadingPage({super.key, required this.controller});

  final TtsController controller;

  @override
  State<TtsReadingPage> createState() => _TtsReadingPageState();
}

class _TtsReadingPageState extends State<TtsReadingPage> {
  final ScrollController _scroll = ScrollController();
  final GlobalKey _listKey = GlobalKey();
  static const _itemExtent = 64.0;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onIndexChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) => _centerOn(true));
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onIndexChanged);
    _scroll.dispose();
    super.dispose();
  }

  void _onIndexChanged() {
    if (widget.controller.status == TtsStatus.speaking) _centerOn(false);
  }

  void _centerOn(bool instant) {
    if (!_scroll.hasClients) return;
    final target =
        widget.controller.sentenceIndex * _itemExtent -
        _scroll.position.maxScrollExtent / 2;
    final clamped = target.clamp(0.0, _scroll.position.maxScrollExtent);
    _scroll.animateTo(
      clamped,
      duration: instant ? Duration.zero : const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final controller = widget.controller;
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              controller.entry?.title ?? '',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              '${controller.sentenceIndex + 1} / '
              '${controller.sentences.length}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: scheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: controller.status == TtsStatus.speaking ? '暂停' : '播放',
            icon: Icon(
              controller.status == TtsStatus.speaking
                  ? Icons.pause_rounded
                  : Icons.play_arrow_rounded,
            ),
            onPressed: controller.togglePlayPause,
          ),
          IconButton(
            tooltip: '停止',
            icon: const Icon(Icons.stop_rounded),
            onPressed: () {
              controller.stopInternal();
              Navigator.of(context).pop();
            },
          ),
        ],
      ),
      body: controller.sentences.isEmpty
          ? const Center(child: Text('没有可朗读的内容'))
          : ListView.builder(
              key: _listKey,
              controller: _scroll,
              itemExtent: _itemExtent,
              padding: const EdgeInsets.symmetric(
                horizontal: 20,
                vertical: 24,
              ),
              itemCount: controller.sentences.length,
              itemBuilder: (context, index) {
                final current = index == controller.sentenceIndex;
                final spoken = index < controller.sentenceIndex;
                return GestureDetector(
                  onTap: () => controller.seekTo(index),
                  child: Container(
                    alignment: Alignment.centerLeft,
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    decoration: BoxDecoration(
                      color: current
                          ? scheme.primaryContainer.withValues(alpha: 0.65)
                          : null,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: AnimatedDefaultTextStyle(
                      duration: const Duration(milliseconds: 200),
                      style: Theme.of(context).textTheme.bodyLarge!.copyWith(
                        fontSize: 18,
                        height: 1.6,
                        color: current
                            ? scheme.onPrimaryContainer
                            : spoken
                            ? scheme.onSurfaceVariant.withValues(alpha: 0.55)
                            : scheme.onSurface,
                        fontWeight: current ? FontWeight.w600 : null,
                      ),
                      child: Text(
                        controller.sentences[index],
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
