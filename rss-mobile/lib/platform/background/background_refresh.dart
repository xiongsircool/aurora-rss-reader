import 'dart:io';

import 'refresh_schedule_settings.dart';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:workmanager/workmanager.dart';

import '../../application/use_cases/refresh_feed.dart';
import '../../data/database/local_database.dart';
import '../../data/repositories/local_content_repository.dart';
import '../../platform/http/io_feed_http_client.dart';

const String kBackgroundRefreshTask = 'aurora.background.refresh';

final backgroundRefreshSettings = RefreshScheduleSettings(
  schedule: (hours) => initBackgroundRefresh(
    interval: Duration(hours: hours),
    enabled: hours > 0,
  ),
);
Future<void>? _initialization;

/// Callback executed by the OS WorkManager in a background isolate.
@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    if (task != kBackgroundRefreshTask) return true;

    LocalDatabase? database;
    IoFeedHttpClient? httpClient;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.reload();
      if (prefs.getInt(RefreshScheduleSettings.key) == 0) {
        await Workmanager().cancelByUniqueName(kBackgroundRefreshTask);
        return true;
      }
      // The Apple plugin re-enqueues before running Dart using its launch-time
      // interval. Replace that request with the latest saved interval.
      if (Platform.isIOS) {
        final hours = await backgroundRefreshSettings.load();
        await Workmanager().registerPeriodicTask(
          kBackgroundRefreshTask,
          kBackgroundRefreshTask,
          frequency: Duration(hours: hours),
          initialDelay: Duration(hours: hours),
          existingWorkPolicy: ExistingPeriodicWorkPolicy.update,
        );
      }
      database = LocalDatabase.onDevice();
      final repository = LocalContentRepository(database);
      httpClient = IoFeedHttpClient(
        useEnvironmentProxy: false,
        proxyUrl: await repository.loadProxyUrl(),
      );
      final refreshFeed = RefreshFeed(
        httpClient: httpClient,
        repository: repository,
      );

      final feeds = await repository.listFeeds();
      var updated = 0;
      for (final feed in feeds) {
        try {
          final result = await refreshFeed(feed);
          updated += result.insertedEntries;
        } catch (_) {
          // Continue with other feeds even if one fails.
        }
      }

      // ignore: avoid_print
      print('Background refresh: $updated new articles');
      return true;
    } catch (e) {
      // ignore: avoid_print
      print('Background refresh failed: $e');
      return false;
    } finally {
      httpClient?.close();
      await database?.close();
    }
  });
}

/// Initializes WorkManager and registers the periodic refresh task.
Future<void> initBackgroundRefresh({
  required Duration interval,
  bool enabled = true,
}) async {
  final initialization = _initialization ??= Workmanager().initialize(
    callbackDispatcher,
  );
  try {
    await initialization;
  } catch (_) {
    _initialization = null;
    rethrow;
  }

  if (enabled) {
    await Workmanager().registerPeriodicTask(
      kBackgroundRefreshTask,
      kBackgroundRefreshTask,
      frequency: interval,
      initialDelay: interval,
      constraints: Constraints(
        networkType: NetworkType.connected,
        requiresBatteryNotLow: true,
      ),
      existingWorkPolicy: ExistingPeriodicWorkPolicy.update,
      backoffPolicy: BackoffPolicy.exponential,
      backoffPolicyDelay: const Duration(minutes: 15),
    );
    if (!await Workmanager().isScheduledByUniqueName(kBackgroundRefreshTask)) {
      throw StateError('Background refresh was not scheduled by the OS');
    }
  } else {
    await Workmanager().cancelByUniqueName(kBackgroundRefreshTask);
  }
}

/// Cancels the background refresh task.
Future<void> cancelBackgroundRefresh() async {
  await Workmanager().cancelByUniqueName(kBackgroundRefreshTask);
}
