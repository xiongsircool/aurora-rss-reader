import 'package:workmanager/workmanager.dart';

import '../../application/use_cases/refresh_feed.dart';
import '../../data/database/local_database.dart';
import '../../data/repositories/local_content_repository.dart';
import '../../platform/http/io_feed_http_client.dart';

const String kBackgroundRefreshTask = 'aurora.background.refresh';

/// Callback executed by the OS WorkManager in a background isolate.
@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    if (task != kBackgroundRefreshTask) return true;

    try {
      final database = LocalDatabase.onDevice();
      final repository = LocalContentRepository(database);
      final httpClient = IoFeedHttpClient(useEnvironmentProxy: false);
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

      httpClient.close();
      await database.close();

      // ignore: avoid_print
      print('Background refresh: $updated new articles');
      return true;
    } catch (e) {
      // ignore: avoid_print
      print('Background refresh failed: $e');
      return false;
    }
  });
}

/// Initializes WorkManager and registers the periodic refresh task.
Future<void> initBackgroundRefresh({
  required Duration interval,
  bool enabled = true,
}) async {
  await Workmanager().initialize(callbackDispatcher);

  if (enabled) {
    await Workmanager().registerPeriodicTask(
      kBackgroundRefreshTask,
      kBackgroundRefreshTask,
      frequency: interval,
      constraints: Constraints(
        networkType: NetworkType.connected,
        requiresBatteryNotLow: true,
      ),
      existingWorkPolicy: ExistingPeriodicWorkPolicy.keep,
      backoffPolicy: BackoffPolicy.exponential,
      backoffPolicyDelay: const Duration(minutes: 15),
    );
  } else {
    await Workmanager().cancelByUniqueName(kBackgroundRefreshTask);
  }
}

/// Cancels the background refresh task.
Future<void> cancelBackgroundRefresh() async {
  await Workmanager().cancelByUniqueName(kBackgroundRefreshTask);
}
