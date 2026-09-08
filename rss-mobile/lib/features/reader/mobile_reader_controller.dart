import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../application/use_cases/extract_article.dart';
import '../../application/use_cases/refresh_feed.dart';
import '../../data/platform/ai_client.dart';
import '../../data/platform/secure_key_store.dart';
import '../../data/repositories/reader_prefs_repository.dart';
import '../../data/repositories/local_content_repository.dart';
import '../settings/about_page.dart' show AppMeta;
import '../../data/services/favicon_resolver.dart';
import '../../platform/notifications/notification_service.dart';
import '../../domain/translation/bilingual_builder.dart';
import '../../domain/translation/block_extractor.dart';
import '../../domain/translation/lang_detect.dart';
import '../../domain/entities/entry.dart';
import '../../domain/entities/feed.dart';
import '../../domain/opml/opml_codec.dart';

final class MobileReaderController extends ChangeNotifier {
  MobileReaderController({
    required this.repository,
    required this.refreshFeed,
    this.extractArticle,
    this.aiClient,
    this.secureKeyStore,
    String? initialProxyUrl,
  }) : _proxyUrl = initialProxyUrl;

  final LocalContentRepository repository;
  final RefreshFeed refreshFeed;
  final ExtractArticle? extractArticle;
  final AiClient? aiClient;
  final SecureKeyStore? secureKeyStore;

  /// Optional icon resolution; null in tests that do not touch the network.
  FaviconResolver? faviconResolver;
  final Set<String> _resolvingIcons = {};
  ReaderPrefsRepository? _prefs;

  List<Feed> _feeds = const [];
  List<Entry> _entries = const [];
  List<Entry> _starredEntries = const [];
  List<Entry> _searchResults = const [];
  final Set<String> _extractingEntryIds = {};
  List<GroupSummary> _groups = const [];
  final Set<String> _mutedGroups = {};
  InboxCursor? _nextCursor;
  bool _initialized = false;
  bool _loading = false;
  bool _adding = false;
  bool _refreshing = false;
  int refreshCompleted = 0;
  int refreshTotal = 0;
  String? searchError;
  int _searchRevision = 0;
  bool _loadingMore = false;
  int _unreadCount = 0;
  bool _searching = false;
  bool _unreadOnly = false;
  String? _error;
  String? _notice;
  List<({String feedId, String title, String error})> _refreshFailures =
      const [];
  String? _proxyUrl;
  String? _aiSummary;
  bool _generatingSummary = false;

  List<Feed> get feeds => _feeds;
  List<GroupSummary> get groups => _groups;
  Set<String> get mutedGroups => _mutedGroups;
  String? get aiSummary => _aiSummary;
  bool get generatingSummary => _generatingSummary;

  // ── Auto title translation (V2, viewport-driven) ──────────────
  bool _autoTranslateTitles = false;
  String _targetLangCode = 'zh';
  final Set<String> _titleTxFlying = {};
  final Map<String, DateTime> _titleTxFailed = {};
  ({String baseUrl, String model, String key})? _titleTxCfg;
  static const _titleTxRetryBackoff = Duration(minutes: 10);
  static const _maxConcurrentTitleTx = 3;
  bool get autoTranslateTitles => _autoTranslateTitles;
  String? get aiConfigError => _error;
  List<Entry> get entries => _entries;
  List<Entry> get starredEntries => _starredEntries;
  List<Entry> get searchResults => _searchResults;
  bool get initialized => _initialized;
  bool get loading => _loading;
  bool get adding => _adding;
  bool get refreshing => _refreshing;
  bool get loadingMore => _loadingMore;
  bool get searching => _searching;
  bool get unreadOnly => _unreadOnly;
  int get unreadCount => _unreadCount;
  bool get hasMore => _nextCursor != null;
  bool isExtracting(String entryId) => _extractingEntryIds.contains(entryId);
  String? get error => _error;
  String? get notice => _notice;
  List<({String feedId, String title, String error})> get refreshFailures =>
      _refreshFailures;

  /// Resolved site icon URL for a feed, if discovered.
  String? feedIconUrl(String feedId) {
    for (final feed in _feeds) {
      if (feed.id == feedId) return feed.iconUrl?.toString();
    }
    return null;
  }

  String? get proxyUrl => _proxyUrl;

  Future<void> initialize() async {
    _prefs ??= ReaderPrefsRepository(repository.database);
    if (_initialized || _loading) return;
    _loading = true;
    notifyListeners();
    try {
      final storedProxy = await repository.loadProxyUrl();
      if (storedProxy != null) _proxyUrl = storedProxy;
      refreshFeed.httpClient.setProxyUrl(_proxyUrl);
      await _loadAutoTranslateSettings();
      await _reload();
      _initialized = true;
      unawaited(_resolveAllMissingIcons());
    } catch (error) {
      _error = '无法打开本地数据库：$error';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Called when AI settings change (from the settings UI) so the
  /// controller picks up auto-translate preferences immediately.
  Future<void> reloadAiPreferences() async {
    _prefs ??= ReaderPrefsRepository(repository.database);
    await _loadAutoTranslateSettings();
    notifyListeners();
  }

  /// Reads AI settings from SharedPreferences (same key the settings
  /// sheet writes) — the single source of truth for the auto-translate
  /// switch and output language.
  Future<void> _loadAutoTranslateSettings() async {
    try {
      final sp = await SharedPreferences.getInstance();
      final raw = sp.getString('ai_settings');
      if (raw == null) return;
      final prefs = jsonDecode(raw);
      if (prefs is! Map<String, dynamic>) return;
      _autoTranslateTitles = prefs['autoTranslateTitles'] as bool? ?? false;
      _targetLangCode = prefs['language'] as String? ?? 'zh';
      _titleTxCfg = null; // config may have changed; reload lazily
    } catch (_) {
      // Missing plugin (tests) or unreadable storage: keep defaults.
    }
  }

  /// Viewport-driven auto translation entry point.
  /// Called by [EntryTile] when a tile is about to become visible;
  /// silently skips anything that should not be translated.
  Future<void> requestTitleTranslation(String entryId) async {
    if (!_autoTranslateTitles) return; // master switch
    final entry = _entryById(entryId);
    if (entry == null || entry.translatedTitle != null) return; // done
    if (_titleTxFlying.contains(entryId)) return; // in flight
    final failedAt = _titleTxFailed[entryId];
    if (failedAt != null &&
        DateTime.now().difference(failedAt) < _titleTxRetryBackoff) {
      return; // recently failed; retry later
    }
    if (_titleTxFlying.length >= _maxConcurrentTitleTx) return; // throttled
    final source = entry.sourceLang ?? detectSourceLang(entry.title);
    if (!shouldTranslate(source, _targetLangCode)) return; // same language

    _titleTxFlying.add(entryId);
    try {
      final result = await _translateTitleWith(
        entryId: entryId,
        title: entry.title,
      );
      if (result == null) {
        _titleTxFailed[entryId] = DateTime.now();
        return;
      }
      _updateEntryInPlace(entryId, result);
    } finally {
      _titleTxFlying.remove(entryId);
    }
  }

  Entry? _entryById(String id) {
    for (final e in _entries) {
      if (e.id == id) return e;
    }
    for (final e in _starredEntries) {
      if (e.id == id) return e;
    }
    return null;
  }

  /// Updates a single entry's translated title in memory and notifies
  /// listeners — no list reload, no scroll jump.
  void _updateEntryInPlace(String id, String translatedTitle) {
    void patch(List<Entry> list) {
      final i = list.indexWhere((e) => e.id == id);
      if (i >= 0) list[i] = list[i].copyWith(translatedTitle: translatedTitle);
    }

    patch(_entries);
    patch(_starredEntries);
    notifyListeners();
  }

  Future<({String baseUrl, String model, String key})?>
  _ensureTitleTxCfg() async {
    final cached = _titleTxCfg;
    if (cached != null) return cached;
    final settings = await repository.loadAiConfig();
    final key = await secureKeyStore?.loadSummaryKey();
    if (settings.baseUrl.isEmpty ||
        settings.model.isEmpty ||
        key == null ||
        key.isEmpty) {
      return null;
    }
    return _titleTxCfg = (
      baseUrl: settings.baseUrl,
      model: settings.model,
      key: key,
    );
  }

  String _langName(String code) => switch (code) {
    'en' => 'English',
    'ja' => 'Japanese',
    'ko' => 'Korean',
    _ => 'Chinese',
  };

  Future<bool> addFeed(String rawUrl, {String? groupName}) async {
    if (_adding) return false;
    final uri = _parseFeedUri(rawUrl);
    if (uri == null) {
      _error = '请输入有效的 HTTP 或 HTTPS 订阅地址';
      notifyListeners();
      return false;
    }

    _adding = true;
    _error = null;
    _notice = null;
    notifyListeners();
    try {
      final feed = Feed(
        id: _feedId(uri),
        title: uri.host,
        url: uri,
        groupName: groupName ?? 'default',
      );
      final result = await refreshFeed(feed);
      await _reload();
      _notice = result.insertedEntries > 0
          ? '已添加 ${result.feedTitle}，获取 ${result.insertedEntries} 篇文章'
          : '${result.feedTitle} 已是最新状态';
      return true;
    } catch (error) {
      _error = '添加订阅失败：${_friendlyRefreshError(error)}（站点可能无法从当前网络访问）';
      return false;
    } finally {
      _adding = false;
      notifyListeners();
    }
  }

  /// Toggles a group's visibility in the inbox. Muted groups disappear
  /// from the inbox entirely (feed subscriptions are untouched).
  Future<void> toggleGroupMuted(String groupName) async {
    if (_mutedGroups.contains(groupName)) {
      _mutedGroups.remove(groupName);
    } else {
      _mutedGroups.add(groupName);
    }
    _loading = true;
    notifyListeners();
    try {
      await _loadFirstPage();
    } catch (error) {
      _error = '加载文章失败：$error';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> setFeedGroup(Feed feed, String groupName) async {
    try {
      await repository.setFeedGroup(feed.id, groupName);
      await _reload();
      _error = null;
      _notice = '「${feed.title}」已移动到 $groupName';
    } catch (error) {
      _error = '移动分组失败：$error';
    }
    notifyListeners();
  }

  Future<void> renameGroup(String oldName, String newName) async {
    final normalized = newName.trim();
    if (normalized.isEmpty || normalized == oldName) return;
    try {
      await repository.renameGroup(oldName, normalized);
      _mutedGroups.remove(oldName);
      await _reload();
      _error = null;
      _notice = '分组已重命名为 $normalized';
    } catch (error) {
      _error = '重命名分组失败：$error';
    }
    notifyListeners();
  }

  Future<void> deleteGroup(String groupName) async {
    try {
      await repository.deleteGroup(groupName);
      _mutedGroups.remove(groupName);
      await _reload();
      _error = null;
      _notice = '分组 $groupName 已解散，订阅移入默认分组';
    } catch (error) {
      _error = '删除分组失败：$error';
    }
    notifyListeners();
  }

  Future<void> refreshAll() async {
    if (_refreshing || _feeds.isEmpty) return;
    _refreshing = true;
    _error = null;
    _notice = null;
    _refreshFailures = const [];
    refreshCompleted = 0;
    refreshTotal = _feeds.length;
    notifyListeners();

    try {
      var inserted = 0;
      final failures = <({String feedId, String title, String error})>[];
      for (final feed in List<Feed>.from(_feeds)) {
        try {
          final result = await refreshFeed(feed);
          inserted += result.insertedEntries;
          await repository.updateFeedStatus(id: feed.id, lastError: null);
          unawaited(_resolveFeedIcon(feed));
        } catch (error) {
          failures.add((
            feedId: feed.id,
            title: feed.title,
            error: _friendlyRefreshError(error),
          ));
          await repository.updateFeedStatus(
            id: feed.id,
            lastError: error.toString(),
          );
        }
        refreshCompleted++;
        notifyListeners();
      }
      await _reload();
      _refreshFailures = failures;
      _notice = failures.isEmpty
          ? '刷新完成，新增 $inserted 篇文章'
          : '刷新完成，新增 $inserted 篇，'
                '${failures.length} 个订阅失败';
      // Show notification for new articles.
      if (inserted > 0) {
        NotificationService.showNewArticles(count: inserted).catchError((_) {});
      }
    } catch (error) {
      _error = '刷新订阅失败：$error';
    } finally {
      _refreshing = false;
      notifyListeners();
    }
  }

  /// Retries only the feeds that failed during the last refreshAll.
  /// Succeeding entries are removed from the failure list; the notice
  /// reflects the retry round only.
  Future<void> retryFailedRefreshes({String? feedId}) async {
    final pending = _refreshFailures
        .where((f) => feedId == null || f.feedId == feedId)
        .toList();
    if (_refreshing || pending.isEmpty) return;
    refreshCompleted = 0;
    refreshTotal = pending.length;
    _refreshing = true;
    _error = null;
    _notice = null;
    notifyListeners();
    try {
      var inserted = 0;
      final stillFailing = _refreshFailures
          .where((f) => feedId != null && f.feedId != feedId)
          .toList();
      for (final failure in pending) {
        final feed = _feeds.where((f) => f.id == failure.feedId).firstOrNull;
        if (feed == null) continue;
        try {
          final result = await refreshFeed(feed);
          inserted += result.insertedEntries;
          await repository.updateFeedStatus(id: feed.id, lastError: null);
          unawaited(_resolveFeedIcon(feed));
        } catch (error) {
          stillFailing.add((
            feedId: failure.feedId,
            title: failure.title,
            error: _friendlyRefreshError(error),
          ));
          await repository.updateFeedStatus(
            id: feed.id,
            lastError: error.toString(),
          );
        }
        refreshCompleted++;
        notifyListeners();
      }
      await _reload();
      _refreshFailures = stillFailing;
      _notice = stillFailing.isEmpty
          ? '重试成功，新增 $inserted 篇文章'
          : '重试后仍有 ${stillFailing.length} 个订阅失败';
      if (inserted > 0) {
        NotificationService.showNewArticles(count: inserted).catchError((_) {});
      }
    } catch (error) {
      _error = '重试失败：$error';
    } finally {
      _refreshing = false;
      notifyListeners();
    }
  }

  /// Translates raw refresh exceptions into short human-readable reasons.
  static String _friendlyRefreshError(Object error) {
    final raw = error.toString().toLowerCase();
    if (raw.contains('timed out') || raw.contains('timeout')) {
      return '响应超时';
    }
    if (raw.contains('handshake') || raw.contains('connection terminated')) {
      return '安全连接被中断（网络或代理不稳定）';
    }
    if (raw.contains('socket') || raw.contains('network')) {
      return '网络连接失败';
    }
    if (raw.contains('invalid') && raw.contains('xml') ||
        raw.contains('parse')) {
      return '返回的不是有效的订阅格式';
    }
    final match = RegExp(r'feedhttpexception\((\d+)\)').firstMatch(raw);
    if (match != null) return 'HTTP ${match.group(1)} 错误';
    return '未知错误';
  }

  Future<void> clearRefreshFailures() async {
    _refreshFailures = const [];
    notifyListeners();
  }

  /// Resolves icons for feeds that still lack one, sequentially in the
  /// background. Called after startup and after refreshes.
  Future<void> _resolveAllMissingIcons() async {
    final resolver = faviconResolver;
    if (resolver == null) return;
    for (final feed in List<Feed>.from(_feeds)) {
      if (feed.iconUrl != null) continue;
      await _resolveFeedIcon(feed);
    }
  }

  /// Resolves and stores a feed icon in the background. Never throws.
  Future<void> _resolveFeedIcon(Feed feed) async {
    final resolver = faviconResolver;
    if (resolver == null || feed.iconUrl != null) return;
    if (!_resolvingIcons.add(feed.id)) return;
    try {
      final iconUrl = await resolver.resolve(feed.url);
      if (iconUrl != null) {
        await repository.updateFeedIconUrl(feed.id, iconUrl);
        await _reload();
      }
    } catch (_) {
      // Icon discovery is best-effort; letter avatars remain the fallback.
    } finally {
      _resolvingIcons.remove(feed.id);
    }
  }

  Future<void> refreshOne(Feed feed) async {
    if (_refreshing) return;
    refreshCompleted = 0;
    refreshTotal = 1;
    _refreshing = true;
    _error = null;
    _notice = null;
    notifyListeners();
    try {
      final result = await refreshFeed(feed);
      unawaited(_resolveFeedIcon(feed));
      await repository.updateFeedStatus(id: feed.id, lastError: null);
      _refreshFailures = _refreshFailures
          .where((failure) => failure.feedId != feed.id)
          .toList();
      await _reload();
      _notice = '${result.feedTitle}：新增 ${result.insertedEntries} 篇';
    } catch (error) {
      await repository.updateFeedStatus(
        id: feed.id,
        lastError: error.toString(),
      );
      _error = '刷新 ${feed.title} 失败：${_friendlyRefreshError(error)}';
    } finally {
      refreshCompleted = 1;
      _refreshing = false;
      notifyListeners();
    }
  }

  Future<void> deleteFeed(Feed feed) async {
    try {
      await repository.deleteFeed(feed.id);
      await _reload();
      _notice = '已删除 ${feed.title}';
    } catch (error) {
      _error = '删除订阅失败：$error';
    }
    notifyListeners();
  }

  Future<int> markInboxRead() async {
    final updated = await repository.markInboxRead();
    await _loadFirstPage();
    _starredEntries = await repository.listStarred();
    notifyListeners();
    return updated;
  }

  Future<void> setUnreadOnly(bool value) async {
    if (_unreadOnly == value) return;
    _unreadOnly = value;
    _loading = true;
    notifyListeners();
    try {
      await _loadFirstPage();
    } catch (error) {
      _error = '加载文章失败：$error';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> loadMore() async {
    final cursor = _nextCursor;
    if (cursor == null || _loadingMore || _refreshing || _loading) return;
    _loadingMore = true;
    _error = null;
    notifyListeners();
    try {
      final page = await repository.listInbox(
        cursor: cursor,
        unreadOnly: _unreadOnly,
        excludeGroups: _mutedGroups,
        translationLang: _targetLangCode,
      );
      _entries = [..._entries, ...page.entries];
      _nextCursor = page.nextCursor;
    } catch (error) {
      _error = '加载更多失败：$error';
    } finally {
      _loadingMore = false;
      notifyListeners();
    }
  }

  Future<void> setRead(Entry entry, {required bool read}) async {
    try {
      await repository.markRead(entry.id, read: read);
      await _loadFirstPage();
      _starredEntries = await repository.listStarred();
    } catch (error) {
      _error = '更新阅读状态失败：$error';
    }
    notifyListeners();
  }

  Future<void> setStarred(Entry entry, {required bool starred}) async {
    try {
      await repository.setStarred(entry.id, starred: starred);
      await _loadFirstPage();
      _starredEntries = await repository.listStarred();
    } catch (error) {
      _error = '更新收藏状态失败：$error';
    }
    notifyListeners();
  }

  Future<Entry?> extractFullText(Entry entry) async {
    final extractor = extractArticle;
    final url = entry.url;
    if (extractor == null ||
        url == null ||
        _extractingEntryIds.contains(entry.id)) {
      return null;
    }

    _extractingEntryIds.add(entry.id);
    _error = null;
    notifyListeners();
    await repository.markExtractionRunning(entry.id);
    try {
      final extracted = await extractor(url);
      await repository.saveExtractedContent(
        entryId: entry.id,
        contentHtml: extracted.contentHtml,
        sourceUrl: extracted.sourceUrl,
      );
      await _loadFirstPage();
      _starredEntries = await repository.listStarred();
      return entry.copyWith(
        readabilityContent: extracted.contentHtml,
        contentSourceUrl: extracted.sourceUrl,
        contentExtractedAt: DateTime.now().toUtc(),
        contentExtractionStatus: ContentExtractionStatus.succeeded,
        clearContentExtractionError: true,
      );
    } catch (error) {
      await repository.saveExtractionFailure(entry.id, error.toString());
      _error = '全文提取失败，继续显示订阅正文：$error';
      return entry.copyWith(
        contentExtractionStatus: ContentExtractionStatus.failed,
        contentExtractionError: error.toString(),
      );
    } finally {
      _extractingEntryIds.remove(entry.id);
      notifyListeners();
    }
  }

  Future<int> importOpml(Uint8List bytes) async {
    try {
      final imported = parseOpml(bytes);
      for (final item in imported) {
        await repository.saveFeed(
          Feed(
            id: _feedId(item.url),
            title: item.title,
            url: item.url,
            groupName: item.groupName,
          ),
        );
      }
      await _reload();
      _error = null;
      _notice = '已导入 ${imported.length} 个订阅';
      notifyListeners();
      return imported.length;
    } catch (error) {
      _error = '导入 OPML 失败：$error';
      notifyListeners();
      return 0;
    }
  }

  String exportOpml() => buildOpml(_feeds);

  /// Full local backup: the entire SQLite database plus a manifest with
  /// the app version, so restores can validate before overwriting.
  /// API keys are intentionally excluded; they stay in secure storage.
  Future<Uint8List> exportFullBackup() async {
    final manifest = jsonEncode({
      'app': 'aurora-mobile',
      'schema': repository.database.schemaVersion,
      'version': AppMeta.version,
      'created': DateTime.now().toUtc().toIso8601String(),
      'feeds': _feeds.length,
    });
    // WAL checkpoint through drift: closing a second connection is not
    // available here, so serialize with VACUUM INTO via a raw statement.
    final dbBytes = await repository.exportDatabaseBytes();
    final archive = <int>[];
    // Simple container: [4-byte magic][4-byte manifest len][manifest][db bytes]
    final magic = utf8.encode('AUR1');
    final manifestBytes = utf8.encode(manifest);
    final length = ByteData(4)..setUint32(0, manifestBytes.length, Endian.big);
    archive
      ..addAll(magic)
      ..addAll(length.buffer.asUint8List())
      ..addAll(manifestBytes)
      ..addAll(dbBytes);
    return Uint8List.fromList(archive);
  }

  /// Restores a full backup created by [exportFullBackup].
  /// Validates the container, closes nothing (drift reconnects), and
  /// replaces the entire database content atomically via VACUUM FROM.
  /// Full-backup import: validates the container, stages the snapshot and
  /// asks the user to restart. The swap happens on next cold start.
  Future<void> importFullBackup(Uint8List bytes) async {
    try {
      // Container check: AUR1 magic + manifest JSON.
      if (bytes.length < 12 ||
          utf8.decode(bytes.sublist(0, 4), allowMalformed: true) != 'AUR1') {
        throw ArgumentError('不是有效的 Aurora 备份文件');
      }
      final manifestLength = ByteData.sublistView(
        bytes,
        4,
        8,
      ).getUint32(0, Endian.big);
      if (8 + manifestLength >= bytes.length) {
        throw ArgumentError('备份文件损坏：清单长度异常');
      }
      final manifest = jsonDecode(
        utf8.decode(bytes.sublist(8, 8 + manifestLength)),
      ) as Map<String, dynamic>;
      if (manifest['app'] != 'aurora-mobile') {
        throw ArgumentError('备份文件来源不符');
      }
      await repository.importFullBackup(bytes.sublist(8 + manifestLength));
      _notice = '备份校验通过，重启应用后完成恢复（恢复将覆盖当前数据）';
    } finally {
      notifyListeners();
    }
  }

  Future<void> search(String query) async {
    final normalized = query.trim();
    if (normalized.isEmpty) {
      clearSearch();
      return;
    }
    final revision = ++_searchRevision;
    _searching = true;
    searchError = null;
    notifyListeners();
    try {
      final results = await repository.search(normalized);
      if (revision != _searchRevision) return;
      _searchResults = results;
    } catch (_) {
      if (revision != _searchRevision) return;
      _searchResults = const [];
      searchError = '搜索失败，请重试';
    } finally {
      if (revision == _searchRevision) {
        _searching = false;
        notifyListeners();
      }
    }
  }

  void clearSearch() {
    _searchRevision++;
    _searchResults = const [];
    _searching = false;
    searchError = null;
    notifyListeners();
  }

  Future<bool> saveProxyUrl(String rawValue) async {
    final normalized = _normalizeProxyUrl(rawValue);
    if (rawValue.trim().isNotEmpty && normalized == null) {
      _error = '代理地址格式应为 host:port 或 http://host:port';
      notifyListeners();
      return false;
    }

    try {
      await repository.saveProxyUrl(normalized);
      refreshFeed.httpClient.setProxyUrl(normalized);
      _proxyUrl = normalized;
      _error = null;
      _notice = normalized == null ? '已关闭自定义代理' : '代理设置已保存';
      notifyListeners();
      return true;
    } catch (error) {
      _error = '保存代理设置失败：$error';
      notifyListeners();
      return false;
    }
  }

  Future<({String baseUrl, String model})> loadAiConfig() {
    return repository.loadAiConfig();
  }

  Future<({String baseUrl, String model, String? apiKey})?>
  loadAiSettings() async {
    final config = await repository.loadAiConfig();
    final key = await secureKeyStore?.loadSummaryKey();
    return (baseUrl: config.baseUrl, model: config.model, apiKey: key);
  }

  Future<void> saveAiSettings({
    required String baseUrl,
    required String model,
    required String apiKey,
  }) async {
    await repository.saveAiConfig(baseUrl: baseUrl, model: model);
    if (apiKey.isNotEmpty && secureKeyStore != null) {
      await secureKeyStore!.saveSummaryKey(apiKey);
    }
  }

  Stream<String> generateSummary({
    required String entryId,
    required String contentHtml,
  }) async* {
    final aiClient = this.aiClient;
    if (aiClient == null || _generatingSummary) return;

    final settings = await repository.loadAiConfig();
    final key = await secureKeyStore?.loadSummaryKey();
    if (settings.baseUrl.isEmpty ||
        settings.model.isEmpty ||
        (key == null || key.isEmpty)) {
      _error = '请先在设置中配置 AI 服务端点和 Key';
      notifyListeners();
      return;
    }

    final plainText = contentHtml.length > 8000
        ? contentHtml.substring(0, 8000)
        : contentHtml;
    if (plainText.trim().length < 30) {
      _error = '文章内容太短';
      notifyListeners();
      return;
    }

    _generatingSummary = true;
    _aiSummary = null;
    _error = null;
    notifyListeners();

    final buffer = StringBuffer();
    try {
      await for (final event in aiClient.summarize(
        config: AiConfig(
          baseUrl: settings.baseUrl,
          apiKey: key,
          model: settings.model,
          language: 'zh',
        ),
        systemPrompt:
            'Summarize the following article concisely in Chinese. '
            'Return 2-4 sentences without preamble.',
        userContent: plainText,
      )) {
        switch (event) {
          case AiDelta(:final text):
            buffer.write(text);
            yield buffer.toString();
            notifyListeners();
          case AiError(:final message):
            _error = 'AI 摘要失败：$message';
            notifyListeners();
            return;
          case AiDone():
            break;
        }
      }
      final result = buffer.toString().trim();
      if (result.isNotEmpty) {
        await repository.saveSummary(
          entryId: entryId,
          language: 'zh',
          summary: result,
        );
        _aiSummary = result;
      }
    } finally {
      _generatingSummary = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>?> loadAiExtendedSettings() async {
    return _prefs?.loadAiExtendedSettings();
  }

  Future<void> saveAiExtendedSettings(Map<String, dynamic> settings) async {
    await _prefs?.saveAiExtendedSettings(settings);
  }

  Future<String?> loadSummaryKey() async {
    return await secureKeyStore?.loadSummaryKey();
  }

  /// Manual translation entry point (reader page button).
  /// Uses the same config cache and target language as auto translation.
  Future<String?> translateTitle({
    required String entryId,
    required String title,
  }) async {
    final result = await _translateTitleWith(entryId: entryId, title: title);
    if (result != null) _updateEntryInPlace(entryId, result);
    return result;
  }

  /// Shared implementation: cache lookup → AI call → persist.
  /// Returns null on any failure (caller decides whether to back off).
  Future<String?> _translateTitleWith({
    required String entryId,
    required String title,
  }) async {
    final aiClient = this.aiClient;
    if (aiClient == null) return null;
    final lang = _targetLangCode;

    final cached = await repository.loadTranslation(
      entryId: entryId,
      language: lang,
    );
    if (cached != null && cached.title.isNotEmpty) return cached.title;

    final cfg = await _ensureTitleTxCfg();
    if (cfg == null) return null;

    final buffer = StringBuffer();
    await for (final event in aiClient.summarize(
      config: AiConfig(
        baseUrl: cfg.baseUrl,
        apiKey: cfg.key,
        model: cfg.model,
        language: lang,
      ),
      systemPrompt:
          'Translate the following article title to ${_langName(lang)}. '
          'Return ONLY the translated title, nothing else.',
      userContent: title,
    )) {
      switch (event) {
        case AiDelta(:final text):
          buffer.write(text);
        case AiError():
          return null;
        case AiDone():
          break;
      }
    }

    final result = buffer.toString().trim();
    if (result.isEmpty || result == title) return null;

    await repository.saveTranslation(
      entryId: entryId,
      language: lang,
      title: result,
    );
    return result;
  }

  /// Translates a block of text and returns the result.
  /// Used for full-text translation, called in segments for long articles.
  Future<String> _translateTextBlock({
    required String text,
    required AiConfig config,
  }) async {
    final buffer = StringBuffer();
    await for (final event in aiClient!.summarize(
      config: config,
      systemPrompt:
          'Translate the following text to '
          '${config.language == 'zh' ? 'Chinese' : config.language}. '
          'Return ONLY the translation, preserving paragraph breaks.',
      userContent: text,
    )) {
      switch (event) {
        case AiDelta(:final text):
          buffer.write(text);
        case AiError():
          throw Exception('Translation failed');
        case AiDone():
          break;
      }
    }
    return buffer.toString().trim();
  }

  /// Translates the full article text in segments.
  /// Streams progress as a fraction (0.0 to 1.0) followed by the
  /// accumulated translated text.
  Stream<({double progress, String text})> translateArticle({
    required String entryId,
    required String contentHtml,
  }) async* {
    if (aiClient == null || _generatingSummary) return;

    final settings = await repository.loadAiConfig();
    final key = await secureKeyStore?.loadSummaryKey();
    if (settings.baseUrl.isEmpty ||
        settings.model.isEmpty ||
        key == null ||
        key.isEmpty) {
      _error = '请先在设置中配置 AI 服务';
      notifyListeners();
      return;
    }

    // Strip HTML to plain text.
    final plainText = contentHtml
        .replaceAll(RegExp(r'<[^>]+>'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();

    if (plainText.length < 30) {
      _error = '文章内容太短';
      notifyListeners();
      return;
    }

    // Split into segments of ~3000 chars, breaking at sentence boundaries.
    const segmentSize = 3000;
    final segments = <String>[];
    var start = 0;
    while (start < plainText.length) {
      var end = (start + segmentSize).clamp(0, plainText.length);
      // Try to break at sentence boundary.
      if (end < plainText.length) {
        final lastPeriod = plainText.lastIndexOf('.', end);
        if (lastPeriod > start + segmentSize * 0.5) {
          end = lastPeriod + 1;
        }
      }
      segments.add(plainText.substring(start, end));
      start = end;
    }

    _generatingSummary = true;
    _error = null;
    notifyListeners();

    final config = AiConfig(
      baseUrl: settings.baseUrl,
      apiKey: key,
      model: settings.model,
      language: 'zh',
    );

    final translatedBuffer = StringBuffer();
    try {
      for (var i = 0; i < segments.length; i++) {
        final segment = segments[i];
        final translated = await _translateTextBlock(
          text: segment,
          config: config,
        );
        if (translated.isNotEmpty) {
          translatedBuffer.write(translated);
          if (i < segments.length - 1) translatedBuffer.write('\n\n');
        }
        yield (
          progress: (i + 1) / segments.length,
          text: translatedBuffer.toString(),
        );
        notifyListeners();
      }
    } finally {
      _generatingSummary = false;
      notifyListeners();
    }
  }

  /// Immersive bilingual translation with concurrent batch processing.
  /// Translates paragraphs in groups of 3 for speed.
  Stream<({double progress, String? bilingualHtml})> translateArticleImmersive({
    required String entryId,
    required String contentHtml,
    void Function(String source, String translated)? onBlockTranslated,
  }) async* {
    if (aiClient == null || _generatingSummary) return;

    final settings = await repository.loadAiConfig();
    final key = await secureKeyStore?.loadSummaryKey();
    if (settings.baseUrl.isEmpty ||
        settings.model.isEmpty ||
        key == null ||
        key.isEmpty) {
      _error = '请先在设置中配置 AI 服务';
      notifyListeners();
      return;
    }

    final blocks = extractTranslatableBlocks(contentHtml);
    if (blocks.isEmpty) {
      _error = '未检测到需要翻译的外文内容';
      notifyListeners();
      return;
    }

    _generatingSummary = true;
    _error = null;
    notifyListeners();

    final translations = <String, String>{};
    final config = AiConfig(
      baseUrl: settings.baseUrl,
      apiKey: key,
      model: settings.model,
      language: 'zh',
    );

    // Concurrent: batch blocks into groups of 3, translate in parallel.
    const concurrency = 3;
    var completed = 0;

    try {
      for (var i = 0; i < blocks.length; i += concurrency) {
        final batch = blocks.skip(i).take(concurrency).toList();

        final results = await Future.wait(
          batch.map((block) async {
            try {
              return await _translateTextBlock(
                text: block.sourceText,
                config: config,
              );
            } catch (_) {
              return '';
            }
          }),
        );

        for (var j = 0; j < batch.length; j++) {
          final block = batch[j];
          final translated = results[j];
          if (translated.isNotEmpty) {
            translations[block.sourceText] = translated;
            onBlockTranslated?.call(block.sourceText, translated);
          }
          completed++;
        }

        final bilingualHtml = buildBilingualHtml(
          originalHtml: contentHtml,
          translations: translations,
        );

        yield (
          progress: completed / blocks.length,
          bilingualHtml: bilingualHtml,
        );
        notifyListeners();
      }
    } finally {
      _generatingSummary = false;
      notifyListeners();
    }
  }

  String feedTitle(String feedId) {
    for (final feed in _feeds) {
      if (feed.id == feedId) return feed.title;
    }
    return '未知订阅';
  }

  Uri? feedUrl(String feedId) {
    for (final feed in _feeds) {
      if (feed.id == feedId) return feed.url;
    }
    return null;
  }

  void clearMessages() {
    if (_error == null && _notice == null) return;
    _error = null;
    _notice = null;
    notifyListeners();
  }

  Future<void> _reload() async {
    _feeds = await repository.listFeeds();
    _groups = await repository.listGroups();
    _mutedGroups.removeWhere(
      (name) => !_groups.any((group) => group.name == name),
    );
    await _loadFirstPage();
    _starredEntries = await repository.listStarred();
  }

  Future<void> _loadFirstPage() async {
    _unreadCount = await repository.countUnread(excludeGroups: _mutedGroups);
    final page = await repository.listInbox(
      unreadOnly: _unreadOnly,
      excludeGroups: _mutedGroups,
      translationLang: _targetLangCode,
    );
    _entries = page.entries;
    _nextCursor = page.nextCursor;
  }
}

String? _normalizeProxyUrl(String input) {
  final trimmed = input.trim();
  if (trimmed.isEmpty) return null;
  final normalized = trimmed.contains('://') ? trimmed : 'http://$trimmed';
  final uri = Uri.tryParse(normalized);
  if (uri == null ||
      uri.scheme != 'http' ||
      uri.host.isEmpty ||
      !uri.hasPort ||
      uri.userInfo.isNotEmpty ||
      (uri.path.isNotEmpty && uri.path != '/') ||
      uri.hasQuery ||
      uri.hasFragment) {
    return null;
  }
  return 'http://${uri.host}:${uri.port}';
}

Uri? _parseFeedUri(String input) {
  final trimmed = input.trim();
  if (trimmed.isEmpty) return null;
  final withScheme = trimmed.contains('://') ? trimmed : 'https://$trimmed';
  final uri = Uri.tryParse(withScheme);
  if (uri == null ||
      (uri.scheme != 'http' && uri.scheme != 'https') ||
      uri.host.isEmpty) {
    return null;
  }
  return uri;
}

String _feedId(Uri uri) {
  var hash = 0x811c9dc5;
  for (final unit in uri.toString().codeUnits) {
    hash ^= unit;
    hash = (hash * 0x01000193) & 0xFFFFFFFF;
  }
  return 'feed-${hash.toRadixString(16).padLeft(8, '0')}';
}
