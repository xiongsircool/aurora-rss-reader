import 'dart:ui' as ui;

import 'package:flutter/material.dart';

/// Untinted glass: only a light blur inside; shadow is clipped OUTSIDE
/// the lens, so it cannot darken the transparent interior.
class ClearGlassSurface extends StatelessWidget {
  const ClearGlassSurface({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return CustomPaint(
      painter: _GlassShadow(dark),
      foregroundPainter: _GlassEdge(dark),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(31),
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 3, sigmaY: 3),
          child: child,
        ),
      ),
    );
  }
}

class _GlassShadow extends CustomPainter {
  const _GlassShadow(this.dark);
  final bool dark;

  @override
  void paint(Canvas canvas, Size size) {
    final lens = RRect.fromRectAndRadius(
      Offset.zero & size,
      const Radius.circular(31),
    );
    canvas.save();
    canvas.clipPath(
      Path()
        ..fillType = PathFillType.evenOdd
        ..addRect((Offset.zero & size).inflate(40))
        ..addRRect(lens),
    );
    canvas.drawRRect(
      lens.shift(const Offset(0, 5)),
      Paint()
        ..color = Colors.black.withValues(alpha: dark ? 0.24 : 0.13)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_GlassShadow oldDelegate) => dark != oldDelegate.dark;
}

class _GlassEdge extends CustomPainter {
  const _GlassEdge(this.dark);
  final bool dark;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = (Offset.zero & size).deflate(0.6);
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, const Radius.circular(31)),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.white.withValues(alpha: dark ? 0.5 : 0.85),
            Colors.white.withValues(alpha: 0.08),
            Colors.black.withValues(alpha: dark ? 0.18 : 0.1),
          ],
        ).createShader(rect),
    );
  }

  @override
  bool shouldRepaint(_GlassEdge oldDelegate) => dark != oldDelegate.dark;
}
