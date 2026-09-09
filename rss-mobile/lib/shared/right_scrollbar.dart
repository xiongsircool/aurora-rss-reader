import 'package:flutter/material.dart';

/// A right-edge position indicator that can also be dragged. The bottom inset
/// keeps the thumb above overlay controls without reducing the scroll viewport.
class RightScrollbar extends StatefulWidget {
  const RightScrollbar({
    required this.controller,
    required this.child,
    this.bottomClearance = 0,
    super.key,
  });
  final ScrollController controller;
  final Widget child;
  final double bottomClearance;
  @override
  State<RightScrollbar> createState() => _RightScrollbarState();
}

class _RightScrollbarState extends State<RightScrollbar> {
  bool _active = false;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final scheme = Theme.of(context).colorScheme;
      return Listener(
        onPointerDown: (event) {
          if (event.localPosition.dx >= constraints.maxWidth - 24) {
            setState(() => _active = true);
          }
        },
        onPointerUp: (_) {
          if (_active) setState(() => _active = false);
        },
        onPointerCancel: (_) {
          if (_active) setState(() => _active = false);
        },
        child: RawScrollbar(
          controller: widget.controller,
          thumbVisibility: true,
          interactive: true,
          scrollbarOrientation: ScrollbarOrientation.right,
          thickness: _active ? 7 : 3.5,
          radius: const Radius.circular(6),
          minThumbLength: 40,
          crossAxisMargin: 3,
          mainAxisMargin: 6,
          thumbColor: _active
              ? scheme.secondary
              : scheme.onSurfaceVariant.withValues(alpha: 0.4),
          padding: EdgeInsets.only(
            bottom:
                widget.bottomClearance +
                MediaQuery.viewPaddingOf(context).bottom,
          ),
          notificationPredicate: (notification) => notification.depth == 0,
          child: ScrollConfiguration(
            behavior: ScrollConfiguration.of(context)
                .copyWith(scrollbars: false),
            child: widget.child,
          ),
        ),
      );
    },
  );
}

/// Gives each tab/list its own controller; IndexedStack tabs must not share
/// the inherited PrimaryScrollController when their scrollbars are visible.
class RightScrollView extends StatefulWidget {
  const RightScrollView({
    required this.builder,
    this.bottomClearance = 0,
    super.key,
  });
  final Widget Function(BuildContext, ScrollController) builder;
  final double bottomClearance;
  @override
  State<RightScrollView> createState() => _RightScrollViewState();
}

class _RightScrollViewState extends State<RightScrollView> {
  final _controller = ScrollController();
  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RightScrollbar(
    controller: _controller,
    bottomClearance: widget.bottomClearance,
    child: widget.builder(context, _controller),
  );
}
