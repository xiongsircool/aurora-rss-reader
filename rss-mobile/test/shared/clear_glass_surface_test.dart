import 'dart:ui' as ui;

import 'package:aurora_mobile/shared/clear_glass_surface.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  for (final brightness in Brightness.values) {
    testWidgets('glass interior has no gray tint in $brightness', (
      tester,
    ) async {
      final key = GlobalKey();
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(brightness: brightness),
          home: Center(
            child: RepaintBoundary(
              key: key,
              child: const SizedBox(
                width: 360,
                height: 150,
                child: ColoredBox(
                  color: Color(0xFFF0C080),
                  child: Center(
                    child: ClearGlassSurface(
                      child: SizedBox(width: 280, height: 62),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.runAsync(() async {
        final boundary =
            key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
        final image = await boundary.toImage();
        try {
          final bytes = (await image.toByteData(
            format: ui.ImageByteFormat.rawRgba,
          ))!;
          final i = (75 * image.width + 180) * 4;
          expect(bytes.getUint8(i), closeTo(240, 1));
          expect(bytes.getUint8(i + 1), closeTo(192, 1));
          expect(bytes.getUint8(i + 2), closeTo(128, 1));
          // Exterior shadow is visible below the lens, not clipped inside it.
          final outside = (110 * image.width + 180) * 4;
          expect(bytes.getUint8(outside), lessThan(240));
        } finally {
          image.dispose();
        }
      });
    });
  }
}
