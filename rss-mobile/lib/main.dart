import 'package:flutter/material.dart';

import 'app/aurora_app.dart';
import 'application/use_cases/extract_article.dart';
import 'application/use_cases/refresh_feed.dart';
import 'data/database/local_database.dart';
import 'data/repositories/local_content_repository.dart';
import 'features/reader/mobile_reader_controller.dart';
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
    initialProxyUrl: configuredProxy.isEmpty ? null : configuredProxy,
  );

  runApp(AuroraApp(controller: controller));
}
