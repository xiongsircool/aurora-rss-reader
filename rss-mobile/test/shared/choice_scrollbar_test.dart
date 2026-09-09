import 'package:aurora_mobile/shared/choice_sheet.dart';
import 'package:aurora_mobile/shared/right_scrollbar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('selection needs apply; cancel and failed apply preserve value', (
    tester,
  ) async {
    final applied = <int>[];
    int? returned;
    var reject = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async {
                returned = await showChoiceSheet<int>(
                  context: context,
                  title: '刷新间隔',
                  selected: 3,
                  options: const [
                    ChoiceOption(value: 3, title: '每 3 小时'),
                    ChoiceOption(value: 6, title: '每 6 小时'),
                  ],
                  onApply: (value) async {
                    if (reject) throw StateError('failed');
                    applied.add(value);
                  },
                );
              },
              child: const Text('选择'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('选择'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('每 6 小时'));
    await tester.pumpAndSettle();
    expect(applied, isEmpty);
    await tester.tap(find.text('取消'));
    await tester.pumpAndSettle();
    expect(returned, isNull);
    await tester.tap(find.text('选择'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('每 6 小时'));
    await tester.pumpAndSettle();
    reject = true;
    await tester.tap(find.text('应用'));
    await tester.pumpAndSettle();
    expect(find.textContaining('设置未能应用'), findsOneWidget);
    expect(applied, isEmpty);
    reject = false;
    await tester.tap(find.text('应用'));
    await tester.pumpAndSettle();
    expect(applied, [6]);
    expect(returned, 6);
  });

  testWidgets(
    'right scrollbar can be dragged without moving other list controllers',
    (tester) async {
      tester.view.physicalSize = const Size(400, 600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final controller = ScrollController();
      addTearDown(controller.dispose);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: RightScrollbar(
              controller: controller,
              bottomClearance: 60,
              child: ListView.builder(
                controller: controller,
                itemExtent: 48,
                itemCount: 100,
                itemBuilder: (_, i) => Text('Article $i'),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(controller.offset, 0);
      await tester.dragFrom(const Offset(395, 30), const Offset(0, 250));
      await tester.pumpAndSettle();
      expect(controller.offset, greaterThan(500));
      expect(tester.takeException(), isNull);
    },
  );
}
