import 'package:flutter/foundation.dart';

import '../../application/use_cases/extract_article.dart';
import '../../application/use_cases/refresh_feed.dart';
import '../../data/repositories/local_content_repository.dart';
import '../../domain/entities/entry.dart';
import '../../domain/entities/feed.dart';
import '../../domain/opml/opml_codec.dart';

final class MobileReaderController extends ChangeNotifier {
  MobileReaderController({
    required this.repository,
    required this.refreshFeed,
    this.extractArticle,
    String? initialProxyUrl,
  }) : _proxyUrl = initialProxyUrl;

  final LocalContentRepository repository;
  final RefreshFeed refreshFeed;
  final ExtractArticle? extractArticle;

  List<Feed> _feeds = const [];
  List<Entry> _entries = const [];
  List<Entry> _starredEntries = const [];
  List<Entry> _searchResults = const [];
  final Set<String> _extractingEntryIds = {};
  List<GroupSummary> _groups = const [];
  String? _selectedGroup;
  InboxCursor? _nextCursor;
  bool _initialized = false;
  bool _loading = false;
  bool _adding = false;
  bool _refreshing = false;
  bool _loadingMore = false;
  bool _searching = false;
  bool _unreadOnly = false;
  String? _error;
  String? _notice;
  String? _proxyUrl;

  List<Feed> get feeds => _feeds;
  List<GroupSummary> get groups => _groups;
  String? get selectedGroup => _selectedGroup;
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
  bool get hasMore => _nextCursor != null;
  bool isExtracting(String entryId) => _extractingEntryIds.contains(entryId);
  String? get error => _error;
  String? get notice => _notice;
  String? get proxyUrl => _proxyUrl;

  Future<void> initialize() async {
    if (_initialized || _loading) return;
    _loading = true;
    notifyListeners();
    try {
      final storedProxy = await repository.loadProxyUrl();
      if (storedProxy != null) _proxyUrl = storedProxy;
      refreshFeed.httpClient.setProxyUrl(_proxyUrl);
      await _reload();
      _initialized = true;
    } catch (error) {
      _error = '无法打开本地数据库：$error';
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

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
      _error = '添加订阅失败：$error';
      return false;
    } finally {
      _adding = false;
      notifyListeners();
    }
  }

  Future<void> setGroup(String? groupName) async {
    if (_selectedGroup == groupName) return;
    _selectedGroup = groupName;
    _loading = true;
    notifyListeners();
    try {
      await _loadFirstPage();
    } catch (error) {
      _error = '切换分组失败：$error';
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
      if (_selectedGroup == oldName) _selectedGroup = normalized;
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
      if (_selectedGroup == groupName) _selectedGroup = null;
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
    notifyListeners();

    try {
      var inserted = 0;
      var failed = 0;
      for (final feed in List<Feed>.from(_feeds)) {
        try {
          final result = await refreshFeed(feed);
          inserted += result.insertedEntries;
        } catch (_) {
          failed++;
        }
      }
      await _reload();
      _notice = failed == 0
          ? '刷新完成，新增 $inserted 篇文章'
          : '刷新完成，新增 $inserted 篇，$failed 个订阅失败';
    } catch (error) {
      _error = '刷新订阅失败：$error';
    } finally {
      _refreshing = false;
      notifyListeners();
    }
  }

  Future<void> refreshOne(Feed feed) async {
    if (_refreshing) return;
    _refreshing = true;
    _error = null;
    _notice = null;
    notifyListeners();
    try {
      final result = await refreshFeed(feed);
      await _reload();
      _notice = '${result.feedTitle}：新增 ${result.insertedEntries} 篇';
    } catch (error) {
      _error = '刷新 ${feed.title} 失败：$error';
    } finally {
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
    final updated = await repository.markInboxRead(groupName: _selectedGroup);
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
    if (cursor == null || _loadingMore) return;
    _loadingMore = true;
    notifyListeners();
    try {
      final page = await repository.listInbox(
        cursor: cursor,
        unreadOnly: _unreadOnly,
        groupName: _selectedGroup,
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

  Future<void> search(String query) async {
    final normalized = query.trim();
    if (normalized.isEmpty) {
      clearSearch();
      return;
    }
    _searching = true;
    _error = null;
    notifyListeners();
    try {
      _searchResults = await repository.search(normalized);
    } catch (error) {
      _searchResults = const [];
      _error = '搜索失败：$error';
    } finally {
      _searching = false;
      notifyListeners();
    }
  }

  void clearSearch() {
    if (_searchResults.isEmpty && !_searching) return;
    _searchResults = const [];
    _searching = false;
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
    if (_selectedGroup != null &&
        !_groups.any((group) => group.name == _selectedGroup)) {
      _selectedGroup = null;
    }
    await _loadFirstPage();
    _starredEntries = await repository.listStarred();
  }

  Future<void> _loadFirstPage() async {
    final page = await repository.listInbox(
      unreadOnly: _unreadOnly,
      groupName: _selectedGroup,
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
