import 'package:shared_preferences/shared_preferences.dart';

/// Serializes startup scheduling and settings changes. UI/storage only commit
/// a new interval after the OS accepts it; a failed apply restores the prior one.
class RefreshScheduleSettings {
  RefreshScheduleSettings({required this.schedule});
  final Future<void> Function(int hours) schedule;
  static const key = 'refresh_interval_hours';
  static const options = [0, 1, 2, 3, 6, 12, 24];
  Future<void> _tail = Future.value();

  Future<int> load() async {
    final prefs = await SharedPreferences.getInstance();
    final hours = prefs.getInt(key) ?? 3;
    return options.contains(hours) ? hours : 3;
  }

  Future<void> _serialized(Future<void> Function() action) {
    final task = _tail.then((_) => action());
    _tail = task.catchError((Object _) {});
    return task;
  }

  Future<void> restore() => _serialized(() async => schedule(await load()));

  Future<void> update(int hours) => _serialized(() async {
    if (!options.contains(hours)) throw ArgumentError.value(hours, 'hours');
    final previous = await load();
    try {
      await schedule(hours);
      final prefs = await SharedPreferences.getInstance();
      if (!await prefs.setInt(key, hours)) {
        throw StateError('Unable to persist interval');
      }
    } catch (_) {
      try {
        await schedule(previous);
      } catch (_) {
        /* Keep the original apply error. */
      }
      rethrow;
    }
  });
}
