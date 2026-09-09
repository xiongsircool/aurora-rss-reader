// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get tabInbox => 'Inbox';

  @override
  String get tabSaved => 'Saved';

  @override
  String get tabSources => 'Sources';

  @override
  String get tabSettings => 'Settings';

  @override
  String get inboxEmpty => 'Inbox is empty';

  @override
  String get inboxNoUnread => 'No unread articles';

  @override
  String get inboxNoEntriesYet => 'No articles fetched yet';

  @override
  String get greetingLateNight => 'Up late';

  @override
  String get greetingMorning => 'Good morning';

  @override
  String get greetingNoon => 'Good noon';

  @override
  String get greetingAfternoon => 'Good afternoon';

  @override
  String get greetingEvening => 'Good evening';

  @override
  String get allRead => 'All caught up';

  @override
  String unreadCount(int count) {
    return '$count unread';
  }

  @override
  String get filter => 'Filter';

  @override
  String get search => 'Search';

  @override
  String get searchArticles => 'Search local articles';

  @override
  String get searchHint => 'Search titles and content';

  @override
  String get searchSearching => 'Searching…';

  @override
  String get searchFailed => 'Search failed, try again';

  @override
  String get searchRetry => 'Retry';

  @override
  String get searchNoMatch => 'No matching articles';

  @override
  String get searchNoMatchHint => 'Try a shorter keyword';

  @override
  String searchResultsCount(int count) {
    return '显示 $count 条匹配结果';
  }

  @override
  String get refreshAll => 'Refresh all subscriptions';

  @override
  String refreshingProgress(int done, int total) {
    return '正在刷新 $done/$total';
  }

  @override
  String refreshDone(int count) {
    return 'Refreshed, $count new articles';
  }

  @override
  String refreshDoneWithFailures(int count, int failed) {
    return 'Refreshed, $count new, $failed failed';
  }

  @override
  String get retryFailedSubs => '重试失败的订阅';

  @override
  String retryStillFailing(int count) {
    return '重试后仍有 $count 个订阅失败';
  }

  @override
  String get viewDetails => 'View';

  @override
  String get refreshDetails => 'Refresh details';

  @override
  String get noFailedFeeds => 'No subscriptions need retrying';

  @override
  String get close => 'Close';

  @override
  String get cancel => 'Cancel';

  @override
  String get apply => 'Apply';

  @override
  String get save => '保存';

  @override
  String get confirm => '确定';

  @override
  String get delete => '删除';

  @override
  String get retry => '重试';

  @override
  String get loadMore => 'Load more';

  @override
  String get loadingMore => 'Loading…';

  @override
  String get loadMoreFailed => 'Load failed, tap to retry';

  @override
  String loadedSoFar(int count) {
    return '已加载 $count 篇，继续加载';
  }

  @override
  String get markRead => 'Mark as read';

  @override
  String get markUnread => 'Mark as unread';

  @override
  String get markAllRead => 'Mark all as read';

  @override
  String get star => 'Save';

  @override
  String get unstar => 'Unsave';

  @override
  String get justNow => 'just now';

  @override
  String minutesAgo(int count) {
    return '${count}m ago';
  }

  @override
  String hoursAgo(int count) {
    return '${count}h ago';
  }

  @override
  String get yesterday => 'yesterday';

  @override
  String daysAgo(int count) {
    return '${count}d ago';
  }

  @override
  String dateMD(int month, int day) {
    return '$month/$day';
  }

  @override
  String dateYMD(int year, int month, int day) {
    return '$year/$month/$day';
  }

  @override
  String get readerSettings => 'Reading settings';

  @override
  String get fontSize => 'Font size';

  @override
  String get lineHeight => 'Line height';

  @override
  String get fontFamily => 'Typeface';

  @override
  String get fontSans => 'System default';

  @override
  String get fontSerif => 'Serif';

  @override
  String get share => 'Share';

  @override
  String get shareCard => 'Share card';

  @override
  String get shareLink => 'Copy link';

  @override
  String get shareText => 'Share text';

  @override
  String get shareMarkdown => 'Share Markdown';

  @override
  String get shareScreenshot => 'Share screenshot';

  @override
  String get linkCopied => 'Link copied';

  @override
  String get copyCode => '复制代码';

  @override
  String get codeCopied => '代码已复制';

  @override
  String get translateTitle => 'Translate title';

  @override
  String get translatingTitle => 'Translating title…';

  @override
  String get aiSummary => 'AI summary';

  @override
  String aiSummaryFailed(String message) {
    return 'AI 摘要失败：$message';
  }

  @override
  String get aiNotConfigured => 'Configure your own endpoint, model and key';

  @override
  String get aiTimeout => 'AI 请求超时';

  @override
  String get regenerate => '重新生成';

  @override
  String get summaryGenerating => '摘要生成中';

  @override
  String get translateArticle => 'Translate article';

  @override
  String translatingProgress(int percent) {
    return '翻译中 · $percent%';
  }

  @override
  String get extractFullText => 'Extract full text';

  @override
  String get extracting => 'Extracting';

  @override
  String get extractFailedPrefix => '提取失败：';

  @override
  String get noBodyUseOriginal => '该订阅没有提供正文，请打开原文阅读。';

  @override
  String get videoHint => '视频内容请点击下方卡片观看。';

  @override
  String get webpageHint => '该地址返回的是网页而非订阅源，站点可能已停用 RSS';

  @override
  String get showSubscriptionContent => '显示订阅原文';

  @override
  String get fullTextCached => '网页全文已缓存';

  @override
  String get openOriginal => 'Open original';

  @override
  String get playAudio => 'Play audio';

  @override
  String get openPlayer => 'Open player';

  @override
  String get playing => 'Playing';

  @override
  String get paused => 'Paused';

  @override
  String get audioLoading => 'Loading audio…';

  @override
  String get audioBuffering => 'Buffering…';

  @override
  String get audioCompleted => 'Playback finished';

  @override
  String get audioFailed =>
      'Audio unavailable right now, check the network and retry';

  @override
  String get audioRetry => 'Reload';

  @override
  String get speedLabel => '播放速度';

  @override
  String get playbackResumed => 'Resumed from last position';

  @override
  String get playbackResumedShort => 'Resumed previous position';

  @override
  String get back10 => 'Back 10 seconds';

  @override
  String get forward30 => 'Forward 30 seconds';

  @override
  String get replay => 'Replay';

  @override
  String get pauseAudio => 'Pause audio';

  @override
  String get retryAudio => 'Retry audio';

  @override
  String get playAudioSemantics => '播放音频';

  @override
  String get pauseAudioSemantics => '暂停音频';

  @override
  String get stopAndClose => 'Stop and close';

  @override
  String get collapseKeepPlaying => 'Collapse player, keep playing';

  @override
  String get backgroundPlayNote =>
      'Keep browsing after collapsing. In-app playback continues; leaving the app pauses it.';

  @override
  String get seekFailed => '跳转失败，请重试';

  @override
  String get pauseInterrupted => '暂时无法暂停，请关闭播放条';

  @override
  String get playInterrupted => '播放中断，请重试';

  @override
  String get settings => 'Settings';

  @override
  String get readingAndAppearance => 'Reading & Appearance';

  @override
  String get readerLayout => 'Reading layout';

  @override
  String get readerLayoutHint =>
      'Adjust font size, line height and typeface from the article toolbar; changes save automatically.';

  @override
  String get theme => 'Theme';

  @override
  String get themeFollowSystem => 'Follows system appearance';

  @override
  String get feedsAndNetwork => 'Sources & Network';

  @override
  String get networkProxy => 'Network proxy';

  @override
  String get proxyDirect => '直连';

  @override
  String get proxyHint => '留空则使用直连。';

  @override
  String get proxyAddressHint => '代理地址格式应为 host:port 或 http://host:port';

  @override
  String get proxySaved => '代理设置已保存';

  @override
  String proxySaveFailed(String error) {
    return '保存代理设置失败：$error';
  }

  @override
  String get httpProxy => 'HTTP 代理';

  @override
  String get backgroundRefresh => 'Background refresh';

  @override
  String get backgroundRefreshOff => 'Off';

  @override
  String backgroundRefreshEvery(int hours) {
    return 'About every ${hours}h, scheduled by the OS';
  }

  @override
  String get refreshIntervalTitle => 'Background refresh interval';

  @override
  String get refreshIntervalHint =>
      'Target interval for checking subscriptions in the background; manual refresh is unaffected. iOS decides actual timing based on usage, battery and network — not an alarm clock.';

  @override
  String everyHours(int hours) {
    return 'Every $hours hours';
  }

  @override
  String hoursSuffix(int hours) {
    return '$hours 小时';
  }

  @override
  String get turnOff => 'Turn off background refresh';

  @override
  String get keepManualRefresh => 'Manual refresh stays available';

  @override
  String get defaultInterval => 'Default interval';

  @override
  String get batteryExemption => 'Battery optimization exemption';

  @override
  String get batteryExemptionHint =>
      'Adjust background restrictions in system settings';

  @override
  String get batteryExemptionBody => '前往系统设置调整后台限制';

  @override
  String get opmlImportExport => 'OPML import & export';

  @override
  String get opmlHint =>
      'Migrates subscriptions only; articles, saves and read state are not included';

  @override
  String get opmlImport => 'Import OPML';

  @override
  String get opmlExport => 'Export OPML';

  @override
  String get aiService => 'AI service';

  @override
  String aiConfiguredWith(String model) {
    return '已配置 · $model';
  }

  @override
  String get aiConnection => '服务连接';

  @override
  String get aiConnectionHint => '端点 · 模型 · API Key';

  @override
  String get aiEndpoint => 'API 端点';

  @override
  String get aiModelId => '模型 ID';

  @override
  String get aiTimeoutTokens => '超时 · 重试 · 输出语言';

  @override
  String get aiThinkingSupport => '支持推理/思考';

  @override
  String get aiThinkingNotSupported => '模型不支持 extended thinking';

  @override
  String get aiTestConnection => '测试连接';

  @override
  String get aiConnectionTestSent => '连接测试已发送…';

  @override
  String get aiNotConfiguredMsg => '请先在设置中配置 AI 服务';

  @override
  String get aiEndpointNotConfigured => '请先在设置中配置 AI 服务端点和 Key';

  @override
  String get aiEndpointEmpty => '请先填写端点';

  @override
  String get dataAndBackup => 'Data & Backup';

  @override
  String get localData => 'Local data';

  @override
  String get statsLoading => '正在读取统计…';

  @override
  String get statsError => '暂时无法读取统计';

  @override
  String readingStats(int feeds, int total) {
    return '$feeds subscriptions · $total articles';
  }

  @override
  String statsDetail(int read, int starred) {
    return '$read read · $starred saved';
  }

  @override
  String get backupAll => 'Back up all data';

  @override
  String get backupAllHint => '导出设备中的数据库，API Key 需单独保管';

  @override
  String get backupFile => 'Aurora 数据备份';

  @override
  String backupFailed(String error) {
    return '备份失败：$error';
  }

  @override
  String get backupDuringRefresh => '刷新中无法备份，请稍后再试';

  @override
  String get restoreBackup => 'Restore backup';

  @override
  String get restoreHint =>
      'Restoring replaces current data; keep a backup first';

  @override
  String get replaceCurrentData => '替换当前数据？';

  @override
  String get replaceCurrentDataBody =>
      '恢复会覆盖当前订阅、文章和阅读记录。请先导出当前备份；API Key 不会随备份迁移。';

  @override
  String get verifyAndPrepare => 'Verify and prepare';

  @override
  String get backupVerified => 'Backup verified';

  @override
  String get backupVerifiedBody =>
      'Restore is ready. Close Aurora and reopen it; changes made before restarting will be overwritten by the backup.';

  @override
  String get gotIt => 'Got it';

  @override
  String get backupInvalid => '不是有效的 Aurora 备份文件';

  @override
  String get backupCorrupt => '备份文件损坏：清单长度异常';

  @override
  String get backupSourceMismatch => '备份文件来源不符';

  @override
  String get backupReadFailed => '备份读取或验证失败，请确认文件完整且与此版本兼容';

  @override
  String backupNewerVersion(int userVersion, int currentVersion) {
    return '备份来自更新版本的 App（数据结构 $userVersion > $currentVersion），请先升级应用';
  }

  @override
  String get about => 'About';

  @override
  String get aboutAurora => 'About Aurora';

  @override
  String get aboutPrivacy => '隐私';

  @override
  String get aboutPrivacyBody =>
      'Aurora 采用本地优先架构：你的订阅、文章、阅读记录与 AI 设置（包括 API Key）全部只保存在这台设备上的本地数据库中，没有任何账号系统，也不会上传到任何服务器。仅在你主动刷新订阅或请求 AI 服务时，才会访问你配置的地址。';

  @override
  String get aboutLinks => '链接';

  @override
  String get aboutRepo => '项目主页（GitHub）';

  @override
  String get aboutRepoSubtitle => '开源 · GPL-3.0';

  @override
  String get aboutFeedback => '问题反馈';

  @override
  String get aboutFeedbackSubtitle => '提交 Issue 帮助改进';

  @override
  String get aboutLicense => '开源许可';

  @override
  String get aboutLicenseSubtitle => '本软件使用的第三方组件许可';

  @override
  String get aboutCopyright => '© 2026 Aurora · 以 GPLv3 协议开源';

  @override
  String get aboutTagline => '本地优先的 RSS 阅读器';

  @override
  String get sponsorGithub => 'GitHub Sponsors 赞助';

  @override
  String get sponsorTitle => '支持开发者';

  @override
  String get noFeedsYet => 'No subscriptions yet';

  @override
  String get addFeed => 'Add subscription';

  @override
  String get addSubscription => 'Add subscription';

  @override
  String get addFeedTitle => '添加订阅';

  @override
  String get addFeedHint => '粘贴 RSS、Atom、播客或带订阅链接的网页地址';

  @override
  String get feedAddressLabel => 'Subscription address';

  @override
  String get feedAddressHintText => 'https://example.com/feed.xml';

  @override
  String get groupLabel => 'Group';

  @override
  String get ungrouped => '未分组';

  @override
  String get fetchAndAdd => 'Fetch and add';

  @override
  String get feedAddressRequired => '请输入订阅地址';

  @override
  String get feedAddressInvalid => '请输入完整的 http:// 或 https:// 地址';

  @override
  String get addingInProgress =>
      'Fetching and parsing the subscription…\nIf it is a webpage, feed links will be discovered automatically.';

  @override
  String addFailedNetwork(String reason) {
    return '添加订阅失败：$reason（站点可能无法从当前网络访问）';
  }

  @override
  String feedUpToDate(String title) {
    return '$title 已是最新状态';
  }

  @override
  String feedAdded(String title, int count) {
    return '已添加 $title，获取 $count 篇文章';
  }

  @override
  String get all => 'All';

  @override
  String get unread => 'Unread';

  @override
  String get groups => 'Groups';

  @override
  String get newGroupName => '新分组名称';

  @override
  String get newGroupEllipsis => '新建分组…';

  @override
  String get moveToGroup => '移动到分组';

  @override
  String groupMoved(String title, String group) {
    return '「$title」已移动到 $group';
  }

  @override
  String groupRenamed(String name) {
    return '分组已重命名为 $name';
  }

  @override
  String groupDeleteConfirm(String title) {
    return '“$title”及其本地文章将被删除。';
  }

  @override
  String get deleteSubscription => '删除订阅';

  @override
  String get deleteSubscriptionConfirm => '删除订阅？';

  @override
  String subscriptionDeleted(String title) {
    return '已删除 $title';
  }

  @override
  String unreadEntries(int count) {
    return '$count unread';
  }

  @override
  String feedUnreadAndStatus(int count, String status) {
    return '$count unread · $status';
  }

  @override
  String get lastRefreshFailed => 'last refresh failed';

  @override
  String get notRefreshedYet => 'not refreshed yet';

  @override
  String get refreshed => 'refreshed';

  @override
  String get refreshThisFeed => 'Refresh this subscription';

  @override
  String get moreActions => '更多操作';

  @override
  String lastCheck(String time) {
    return 'Last checked: $time';
  }

  @override
  String get savedEmpty => 'No saved articles';

  @override
  String get savedHint => 'Save articles you like for later';

  @override
  String savedCount(int count) {
    return '$count saved';
  }

  @override
  String get selectArticle => 'Select an article to read';

  @override
  String get sharePreview => 'Share preview';

  @override
  String get cardSummary => 'Summary card';

  @override
  String get cardSummaryHint =>
      'Confirm the layout before sharing; the QR code points to the original article.';

  @override
  String get updatePreview => 'Update preview';

  @override
  String get shareThisImage => 'Share this image';

  @override
  String get contentModified => 'Content changed — update the preview first.';

  @override
  String get includeImage => 'Include image';

  @override
  String get articleImage => 'Article image';

  @override
  String get chooseImage => 'Choose card image';

  @override
  String get chooseImageHint =>
      'Images are shown in full proportion. Tap “Use this image” and the preview updates automatically.';

  @override
  String get useThisImage => 'Use this image';

  @override
  String get textOnlyCard => 'Text-only card';

  @override
  String get noImage => 'No article image';

  @override
  String get imageUnavailable =>
      'This image is unavailable; the preview fell back to text. You can pick another one.';

  @override
  String get shareExcerpt => 'Share excerpt';

  @override
  String get excerptHint =>
      'Up to six lines on the card; longer text is ellipsized.';

  @override
  String get previewFailed => 'Preview failed, try again';

  @override
  String get shareSaveFailed =>
      'Could not save the image or open the share sheet, try again';

  @override
  String get cardPreviewLabel => '即将分享的卡片预览';

  @override
  String get shareCardContent => '分享摘要';

  @override
  String get excerptHelper => '卡片最多展示六行，较长内容会省略。';

  @override
  String get qrcodeHint => '扫码阅读原文';

  @override
  String get articleShare => '文章分享';

  @override
  String get qrScanHint => '扫码或点击阅读原文';

  @override
  String get brandFooter => 'Aurora · 本地优先 RSS 阅读器';

  @override
  String get auroraBrand => 'Aurora';

  @override
  String get noFeedsForExport => '当前没有可导出的订阅';

  @override
  String opmlImportFailed(String error) {
    return '导入 OPML 失败：$error';
  }

  @override
  String opmlExportFailed(String error) {
    return '导出失败：$error';
  }

  @override
  String get opmlNoValidFeeds => '文件中没有有效订阅';

  @override
  String opmlImported(int count) {
    return '已导入 $count 个订阅';
  }

  @override
  String notificationNewArticles(int count) {
    return '$count 篇新文章';
  }

  @override
  String get subscriptionNotificationChannel => '订阅源刷新后收到的新文章通知';

  @override
  String get deleteGroupTitle => '解散分组（订阅移入未分组）';

  @override
  String get renameGroup => '重命名分组';

  @override
  String get showGroupName => '显示的分组';

  @override
  String get noGroupsYet => '暂无分组';

  @override
  String groupFeedCount(int count) {
    return '$count 源';
  }

  @override
  String groupUnread(int count) {
    return '$count 未读';
  }

  @override
  String groupFeedsAndUnread(int count, int unread) {
    return '$count 源 · $unread 未读';
  }

  @override
  String moveGroupFailed(String error) {
    return '移动分组失败：$error';
  }

  @override
  String renameGroupFailed(String error) {
    return '重命名分组失败：$error';
  }

  @override
  String loadArticlesFailed(String error) {
    return '加载文章失败：$error';
  }

  @override
  String updateReadStateFailed(String error) {
    return '更新阅读状态失败：$error';
  }

  @override
  String updateStarredFailed(String error) {
    return '更新收藏状态失败：$error';
  }

  @override
  String get imageLoadFailed => '图片加载失败';

  @override
  String get savedToGallery => '已保存到相册';

  @override
  String get saveToGallery => '保存到相册';

  @override
  String get saveFailed => '保存失败';

  @override
  String extractFailedKeepContent(String error) {
    return '全文提取失败，继续显示订阅正文：$error';
  }

  @override
  String get openLinkFailed => '无法打开链接';

  @override
  String get bili => '哔哩哔哩';

  @override
  String get video => '视频';

  @override
  String get videoCardHint => '视频内容请点击下方卡片观看。';

  @override
  String get noBodyTryExtract => '该订阅没有提供正文，请尝试提取全文或打开原文。';

  @override
  String get translateTitleButton => '翻译标题';

  @override
  String get translatingTitleProgress => '翻译标题中…';

  @override
  String get unknownFeed => '未知订阅';

  @override
  String get unknownError => '未知错误';

  @override
  String get errorTimeout => '站点响应超时，';

  @override
  String get errorAntiBot => '该网站启用了反爬保护，';

  @override
  String get error403 => '站点拒绝访问（403），';

  @override
  String get errorNetwork => '网络连接失败，';

  @override
  String get errorHandshake => '安全连接被中断（网络或代理不稳定）';

  @override
  String get errorParse => '返回的不是有效的订阅格式';

  @override
  String errorHttpStatus(String code) {
    return 'HTTP $code 错误';
  }

  @override
  String refreshOneFailed(String title, String reason) {
    return '刷新 $title 失败：$reason';
  }

  @override
  String refreshAllFailed(String error) {
    return '刷新订阅失败：$error';
  }

  @override
  String get addFailedPrefix => '添加订阅失败：';

  @override
  String get addFailedNetworkReason => '站点可能无法从当前网络访问';

  @override
  String newArticlesNotification(int count) {
    return '$count 篇新文章';
  }

  @override
  String get subscriptionChannelName => '订阅源刷新后收到的新文章通知';

  @override
  String get deleteGroupMoveToDefault => '解散分组（订阅移入未分组）';

  @override
  String get renameGroupTitle => '重命名分组';

  @override
  String get newGroupNameLabel => '新分组名称';

  @override
  String get showGroupNameLabel => '显示的分组';

  @override
  String get noGroupsLabel => '暂无分组';

  @override
  String sourcesCount(int count) {
    return '$count 个订阅';
  }

  @override
  String get errorTimeoutMsg => '站点响应超时，';

  @override
  String get errorAntiBotMsg => '该网站启用了反爬保护，';

  @override
  String get error403Msg => '站点拒绝访问（403），';

  @override
  String get errorNetworkMsg => '网络连接失败，';

  @override
  String get errorHandshakeMsg => '安全连接被中断（网络或代理不稳定）';

  @override
  String get errorParseMsg => '返回的不是有效的订阅格式';

  @override
  String errorHttpStatusMsg(String code) {
    return 'HTTP $code 错误';
  }

  @override
  String refreshOneFailedMsg(String title, String reason) {
    return '刷新 $title 失败：$reason';
  }

  @override
  String refreshAllFailedMsg(String error) {
    return '刷新订阅失败：$error';
  }
}
