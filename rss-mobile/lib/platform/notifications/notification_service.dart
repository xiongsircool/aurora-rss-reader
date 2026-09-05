import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Manages local notifications for new articles.
class NotificationService {
  static final _plugin = FlutterLocalNotificationsPlugin();
  static bool _initialized = false;

  static Future<void> init() async {
    if (_initialized) return;

    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    await _plugin.initialize(
      settings: const InitializationSettings(
        android: androidSettings,
        iOS: iosSettings,
      ),
    );
    _initialized = true;
  }

  /// Shows a notification about newly fetched articles.
  static Future<void> showNewArticles({
    required int count,
    String? feedTitle,
  }) async {
    if (!_initialized || count <= 0) return;

    const androidDetails = AndroidNotificationDetails(
      'aurora_new_articles',
      '新文章',
      channelDescription: '订阅源刷新后收到的新文章通知',
      importance: Importance.low,
      priority: Priority.low,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: false,
    );

    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    final title = count == 1 ? (feedTitle ?? '新文章') : '$count 篇新文章';

    await _plugin.show(
      id: 0,
      title: title,
      body: '下拉刷新查看最新内容',
      notificationDetails: details,
    );
  }

  /// Cancels all pending notifications.
  static Future<void> cancelAll() async {
    if (!_initialized) return;
    await _plugin.cancelAll();
  }
}
