import 'dart:io';

import 'package:flutter/material.dart';

import 'package:path_provider/path_provider.dart';

import 'app/aurora_app.dart';
import 'application/use_cases/extract_article.dart';
import 'application/use_cases/refresh_feed.dart';
import 'data/database/local_database.dart';
import 'data/platform/ai_client.dart';
import 'data/platform/secure_key_store.dart';
import 'data/repositories/local_content_repository.dart';
import 'data/services/favicon_resolver.dart';
import 'data/services/feed_icon_cache.dart';
import 'features/reader/mobile_reader_controller.dart';
import 'platform/background/background_refresh.dart';
import 'platform/notifications/notification_service.dart';
import 'platform/http/io_feed_http_client.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Apply a staged full-backup restore before drift opens the database.
  await LocalDatabase.restorePendingIfExists();
  final database = LocalDatabase.onDevice();
  final repository = LocalContentRepository(database);
  const configuredProxy = String.fromEnvironment('AURORA_PROXY_URL');
  final httpClient = IoFeedHttpClient(
    proxyUrl: configuredProxy.isEmpty ? null : configuredProxy,
  );
  final controller = MobileReaderController(
    repository: repository,
    refreshFeed: RefreshFeed(httpClient: httpClient, repository: repository),
    extractArticle: ExtractArticle(httpClient: httpClient),
    aiClient: AiClient(),
    secureKeyStore: const SecureKeyStore(),
    initialProxyUrl: configuredProxy.isEmpty ? null : configuredProxy,
  );
  // Feed icon discovery and caching (best-effort, letter avatars remain
  // the fallback when every strategy fails).
  final iconDirectory = Directory(
    '${(await getApplicationSupportDirectory()).path}/feed-icons',
  );
  controller.faviconResolver = FaviconResolver(httpClient);
  controller.feedIconCache = FeedIconCache(iconDirectory, client: httpClient);

  runApp(AuroraApp(controller: controller));

  // Initialize notifications.
  NotificationService.init().catchError((_) {});

  // Initialize background refresh after the UI is up.
  initBackgroundRefresh(
    interval: const Duration(hours: 3),
    enabled: true,
  ).catchError((_) {
    // Background refresh is a bonus; ignore init failures.
  });
}
