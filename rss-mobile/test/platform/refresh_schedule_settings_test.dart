import 'package:aurora_mobile/platform/background/refresh_schedule_settings.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('startup honors disabled and non-default saved intervals', () async {
    for (final value in [0, 6, 24]) {
      SharedPreferences.setMockInitialValues({
        RefreshScheduleSettings.key: value,
      });
      final calls = <int>[];
      final settings = RefreshScheduleSettings(
        schedule: (hours) async {
          calls.add(hours);
        },
      );
      await settings.restore();
      expect(calls, [value]);
    }
  });

  test('schedule failure leaves stored preference unchanged and restores old schedule', () async {
    SharedPreferences.setMockInitialValues({RefreshScheduleSettings.key: 6});
    final calls = <int>[];
    final settings = RefreshScheduleSettings(
      schedule: (hours) async {
        calls.add(hours);
        if (hours == 1) throw StateError('OS rejected task');
      },
    );
    await expectLater(settings.update(1), throwsStateError);
    expect(await settings.load(), 6);
    expect(calls, [1, 6]);
    await settings.update(12);
    expect(await settings.load(), 12);
  });

  test(
    'startup and edits serialize; last applied value survives relaunch',
    () async {
      SharedPreferences.setMockInitialValues({});
      final calls = <int>[];
      final settings = RefreshScheduleSettings(
        schedule: (hours) async {
          calls.add(hours);
        },
      );
      await Future.wait([
        settings.restore(),
        settings.update(6),
        settings.update(0),
      ]);
      expect(calls, [3, 6, 0]);
      await settings.restore();
      expect(calls.last, 0);
      expect(await settings.load(), 0);
      await expectLater(settings.update(-1), throwsArgumentError);
      expect(await settings.load(), 0);
    },
  );
}
