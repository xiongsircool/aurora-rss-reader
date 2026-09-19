import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart' show Variable;
import 'package:flutter/foundation.dart';
import 'package:home_widget/home_widget.dart';

import '../../data/repositories/local_content_repository.dart';

const String _appGroupId = 'group.com.xiongsircool.aurora.mobile';
const String _widgetDataKey = 'auroraWidgetData';
const String _pendingActionsKey = 'auroraWidgetPendingActions';
const String _iOSWidgetName = 'AuroraHomeWidget';
const String _androidWidgetName = 'AuroraHomeWidgetProvider';

/// Builds a snapshot of glanceable data (latest articles + weekly reading
/// stats) and pushes it into the shared App Group container, then asks
/// WidgetKit to reload the widget timeline.
///
/// Design notes (see widget design doc v2):
/// - Prefer the 3 newest unread articles; when everything is read fall back
///   to the 3 newest articles overall so the widget never looks broken.
/// - Titles prefer the cached Chinese translation when available.
Future<void> updateAuroraWidget(LocalContentRepository repository) async {
  if (!Platform.isIOS && !Platform.isAndroid) return;
  try {
    await HomeWidget.setAppGroupId(_appGroupId);
    await _drainPendingMarkRead(repository);

    // Latest unread articles (falls back to latest overall when all read).
    // Fetch 6: medium widget shows 3, large widget shows 6.
    final unreadPage = await repository.listInbox(unreadOnly: true, limit: 6);
    var articles = unreadPage.entries;
    if (articles.isEmpty) {
      final latestPage = await repository.listInbox(limit: 6);
      articles = latestPage.entries;
    }

    // Feed display names.
    final feedNames = <String, String>{};
    for (final feed in await repository.listFeeds()) {
      feedNames[feed.id] = feed.title;
    }

    final unreadCount = await repository.countUnread();
    final stats = await _weeklyReadStats(repository);

    final snapshot = <String, Object?>{
      'updatedAt': DateTime.now().millisecondsSinceEpoch,
      'unreadCount': unreadCount,
      'articles': articles
          .map(
            (e) => <String, Object?>{
              'id': e.id,
              'title': (e.translatedTitle?.isNotEmpty ?? false)
                  ? e.translatedTitle
                  : e.title,
              'feed': feedNames[e.feedId] ?? '',
              'publishedAtMs':
                  (e.publishedAt ?? e.insertedAt).millisecondsSinceEpoch,
              'unread': !e.isRead,
              'starred': e.isStarred,
            },
          )
          .toList(),
      'weekCount': stats.$1,
      'prevWeekCount': stats.$2,
    };

    await HomeWidget.saveWidgetData<String>(
      _widgetDataKey,
      jsonEncode(snapshot),
    );
    await HomeWidget.updateWidget(
      iOSName: _iOSWidgetName,
      androidName: _androidWidgetName,
    );
  } catch (e) {
    // Widget updates must never break the host flow (background refresh,
    // app lifecycle) — log and move on.
    debugPrint('AuroraWidget: update failed: $e');
  }
}

/// Applies mark-as-read actions queued by the iOS 17 widget button, then
/// clears the queue. Idempotent: missing ids are ignored.
Future<void> _drainPendingMarkRead(LocalContentRepository repository) async {
  try {
    final raw = await HomeWidget.getWidgetData<List>(_pendingActionsKey);
    final ids = (raw ?? const []).whereType<String>().toList();
    if (ids.isEmpty) return;
    for (final id in ids) {
      try {
        await repository.markRead(id, read: true);
      } catch (_) {
        // Unknown id — the entry may have been deleted; skip it.
      }
    }
    await HomeWidget.saveWidgetData<List>(_pendingActionsKey, const []);
  } catch (e) {
    debugPrint('AuroraWidget: drain pending actions failed: $e');
  }
}

/// Returns (thisWeekRead, prevWeekRead) based on `entries.read_at`.
Future<(int, int)> _weeklyReadStats(LocalContentRepository repository) async {
  try {
    final now = DateTime.now();
    final weekAgo = now.subtract(const Duration(days: 7));
    final twoWeeksAgo = now.subtract(const Duration(days: 14));
    final rows = await repository.database
        .customSelect(
          'SELECT '
          'SUM(CASE WHEN read_at >= ? THEN 1 ELSE 0 END) AS w, '
          'SUM(CASE WHEN read_at >= ? AND read_at < ? THEN 1 ELSE 0 END) AS p '
          'FROM entries WHERE read_at IS NOT NULL',
          variables: [
            Variable<DateTime>(weekAgo),
            Variable<DateTime>(twoWeeksAgo),
            Variable<DateTime>(weekAgo),
          ],
          readsFrom: {repository.database.entries},
        )
        .get();
    if (rows.isEmpty) return (0, 0);
    return (rows.first.read<int>('w'), rows.first.read<int>('p'));
  } catch (e) {
    debugPrint('AuroraWidget: stats query failed: $e');
    return (0, 0);
  }
}
