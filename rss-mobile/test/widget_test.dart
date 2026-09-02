import 'package:aurora_mobile/app/aurora_app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('moves from empty inbox to sources and settings', (tester) async {
    await tester.pumpWidget(const AuroraApp());

    expect(find.text('Aurora'), findsOneWidget);
    expect(find.text('收件箱为空'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, '添加订阅'));
    await tester.pumpAndSettle();
    expect(find.text('还没有订阅源'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.settings_outlined));
    await tester.pumpAndSettle();
    expect(find.text('数据模式'), findsOneWidget);
    expect(find.text('本地模式'), findsOneWidget);
  });
}
