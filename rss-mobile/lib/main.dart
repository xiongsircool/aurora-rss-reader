import 'package:flutter/material.dart';

import 'app/aurora_app.dart';
import 'application/use_cases/extract_article.dart';
import 'application/use_cases/refresh_feed.dart';
import 'data/database/local_database.dart';
import 'data/platform/ai_client.dart';
import 'data/platform/secure_key_store.dart';
import 'data/repositories/local_content_repository.dart';
import 'features/reader/mobile_reader_controller.dart';
import 'platform/background/background_refresh.dart';
import 'platform/notifications/notification_service.dart';
import 'platform/http/io_feed_http_client.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

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
