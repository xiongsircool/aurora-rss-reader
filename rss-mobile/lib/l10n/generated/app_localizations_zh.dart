// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Chinese (`zh`).
class AppLocalizationsZh extends AppLocalizations {
  AppLocalizationsZh([String locale = 'zh']) : super(locale);

  @override
  String get tabInbox => '收件箱';

  @override
  String get tabSaved => '收藏';

  @override
  String get tabSources => '订阅';

  @override
  String get tabSettings => '设置';

  @override
  String get inboxEmpty => '收件箱为空';

  @override
  String get inboxNoUnread => '没有未读文章';

  @override
  String get inboxNoEntriesYet => '还没有获取到文章';

  @override
  String get greetingLateNight => '夜深了';

  @override
  String get greetingMorning => '早上好';

  @override
  String get greetingNoon => '中午好';

  @override
  String get greetingAfternoon => '下午好';

  @override
  String get greetingEvening => '晚上好';

  @override
  String get allRead => '已全部读完';

  @override
  String unreadCount(int count) {
    return '$count 篇未读';
  }

  @override
  String get filter => '筛选';

  @override
  String get search => '搜索';

  @override
  String get searchArticles => '搜索本地文章';

  @override
  String get searchHint => '搜索标题和正文';

  @override
  String get searchSearching => '正在搜索…';

  @override
  String get searchFailed => '搜索失败，请重试';

  @override
  String get searchRetry => '重试';

  @override
  String get searchNoMatch => '没有匹配文章';

  @override
  String get searchNoMatchHint => '试试更短的关键词';

  @override
  String searchResultsCount(int count) {
    return '显示 $count 条匹配结果';
  }

  @override
  String get refreshAll => '刷新全部订阅';

  @override
  String refreshingProgress(int done, int total) {
    return '正在刷新 $done/$total';
  }

  @override
  String refreshDone(int count) {
    return '刷新完成，新增 $count 篇文章';
  }

  @override
  String refreshDoneWithFailures(int count, int failed) {
    return '刷新完成，新增 $count 篇，$failed 个订阅失败';
  }

  @override
  String get retryFailedSubs => '重试失败的订阅';

  @override
  String retryStillFailing(int count) {
    return '重试后仍有 $count 个订阅失败';
  }

  @override
  String get viewDetails => '查看';

  @override
  String get refreshDetails => '刷新详情';

  @override
  String get noFailedFeeds => '没有需要重试的订阅';

  @override
  String get close => '关闭';

  @override
  String get cancel => '取消';

  @override
  String get apply => '应用';

  @override
  String get save => '保存';

  @override
  String get confirm => '确定';

  @override
  String get delete => '删除';

  @override
  String get retry => '重试';

  @override
  String get loadMore => '加载更多';

  @override
  String get loadingMore => '正在加载…';

  @override
  String get loadMoreFailed => '加载失败，点击重试';

  @override
  String loadedSoFar(int count) {
    return '已加载 $count 篇，继续加载';
  }

  @override
  String get markRead => '标为已读';

  @override
  String get markUnread => '标为未读';

  @override
  String get markAllRead => '全部标为已读';

  @override
  String get star => '收藏';

  @override
  String get unstar => '取消收藏';

  @override
  String get justNow => '刚刚';

  @override
  String minutesAgo(int count) {
    return '$count分钟前';
  }

  @override
  String hoursAgo(int count) {
    return '$count小时前';
  }

  @override
  String get yesterday => '昨天';

  @override
  String daysAgo(int count) {
    return '$count天前';
  }

  @override
  String dateMD(int month, int day) {
    return '$month月$day日';
  }

  @override
  String dateYMD(int year, int month, int day) {
    return '$year年$month月$day日';
  }

  @override
  String get readerSettings => '阅读设置';

  @override
  String get fontSize => '字号';

  @override
  String get lineHeight => '行距';

  @override
  String get fontFamily => '字体';

  @override
  String get fontSans => '系统默认';

  @override
  String get fontSerif => '衬线';

  @override
  String get share => '分享';

  @override
  String get shareCard => '分享卡片';

  @override
  String get shareLink => '复制链接';

  @override
  String get shareText => '分享文本';

  @override
  String get shareMarkdown => '分享 Markdown';

  @override
  String get shareScreenshot => '分享截图';

  @override
  String get linkCopied => '链接已复制';

  @override
  String get copyCode => '复制代码';

  @override
  String get codeCopied => '代码已复制';

  @override
  String get translateTitle => '翻译标题';

  @override
  String get translatingTitle => '翻译标题中…';

  @override
  String get aiSummary => 'AI 摘要';

  @override
  String aiSummaryFailed(String message) {
    return 'AI 摘要失败：$message';
  }

  @override
  String get aiNotConfigured => 'AI 未配置';

  @override
  String get aiTimeout => 'AI 请求超时';

  @override
  String get regenerate => '重新生成';

  @override
  String get summaryGenerating => '摘要生成中';

  @override
  String get translateArticle => '翻译全文';

  @override
  String translatingProgress(int percent) {
    return '翻译中 · $percent%';
  }

  @override
  String get extractFullText => '提取网页全文';

  @override
  String get extracting => '正在提取';

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
  String get openOriginal => '打开原文';

  @override
  String get playAudio => '播放音频';

  @override
  String get openPlayer => '打开播放器';

  @override
  String get playing => '正在播放';

  @override
  String get paused => '已暂停';

  @override
  String get audioLoading => '正在加载音频…';

  @override
  String get audioBuffering => '正在缓冲…';

  @override
  String get audioCompleted => '已播放完毕';

  @override
  String get audioFailed => '音频暂时无法加载，请检查网络后重试';

  @override
  String get audioRetry => '重新加载';

  @override
  String get speedLabel => '播放速度';

  @override
  String get playbackResumed => '已恢复上次进度';

  @override
  String get playbackResumedShort => '已恢复到上次播放位置';

  @override
  String get back10 => '后退 10 秒';

  @override
  String get forward30 => '前进 30 秒';

  @override
  String get replay => '重新播放';

  @override
  String get pauseAudio => '暂停音频';

  @override
  String get retryAudio => '重试音频';

  @override
  String get playAudioSemantics => '播放音频';

  @override
  String get pauseAudioSemantics => '暂停音频';

  @override
  String get stopAndClose => '停止播放并关闭';

  @override
  String get collapseKeepPlaying => '收起播放器，继续播放';

  @override
  String get backgroundPlayNote => '收起后可继续浏览文章。当前支持应用内持续播放，离开应用时会暂停。';

  @override
  String get seekFailed => '跳转失败，请重试';

  @override
  String get pauseInterrupted => '暂时无法暂停，请关闭播放条';

  @override
  String get playInterrupted => '播放中断，请重试';

  @override
  String get settings => '设置';

  @override
  String get readingAndAppearance => '阅读与外观';

  @override
  String get readerLayout => '阅读排版';

  @override
  String get readerLayoutHint => '在文章右上角调整字号、行距和字体，设置会自动保存。';

  @override
  String get theme => '深浅主题';

  @override
  String get themeFollowSystem => '跟随系统外观';

  @override
  String get feedsAndNetwork => '订阅与网络';

  @override
  String get networkProxy => '网络代理';

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
  String get backgroundRefresh => '后台刷新';

  @override
  String get backgroundRefreshOff => '已关闭';

  @override
  String backgroundRefreshEvery(int hours) {
    return '约每 $hours 小时，执行时间由系统安排';
  }

  @override
  String get refreshIntervalTitle => '后台刷新间隔';

  @override
  String get refreshIntervalHint =>
      '这是后台检查订阅的目标间隔，不影响手动刷新。iOS 会根据使用习惯、电量和网络决定实际执行时间，并非定时闹钟。';

  @override
  String everyHours(int hours) {
    return '每 $hours 小时';
  }

  @override
  String hoursSuffix(int hours) {
    return '$hours 小时';
  }

  @override
  String get turnOff => '关闭后台刷新';

  @override
  String get keepManualRefresh => '保留手动刷新功能';

  @override
  String get defaultInterval => '默认间隔';

  @override
  String get batteryExemption => '电池优化豁免';

  @override
  String get batteryExemptionHint => '前往系统设置调整后台限制';

  @override
  String get batteryExemptionBody => '前往系统设置调整后台限制';

  @override
  String get opmlImportExport => 'OPML 导入与导出';

  @override
  String get opmlHint => '迁移订阅列表，不包含文章、收藏和阅读记录';

  @override
  String get opmlImport => '导入 OPML';

  @override
  String get opmlExport => '导出 OPML';

  @override
  String get aiService => 'AI 服务';

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
  String get dataAndBackup => '数据与备份';

  @override
  String get localData => '本地数据';

  @override
  String get statsLoading => '正在读取统计…';

  @override
  String get statsError => '暂时无法读取统计';

  @override
  String readingStats(int feeds, int total) {
    return '$feeds 个订阅 · $total 篇文章';
  }

  @override
  String statsDetail(int read, int starred) {
    return '已读 $read · 收藏 $starred';
  }

  @override
  String get backupAll => '备份全部数据';

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
  String get restoreBackup => '恢复备份';

  @override
  String get restoreHint => '恢复将替换当前数据，请先保留当前备份';

  @override
  String get replaceCurrentData => '替换当前数据？';

  @override
  String get replaceCurrentDataBody =>
      '恢复会覆盖当前订阅、文章和阅读记录。请先导出当前备份；API Key 不会随备份迁移。';

  @override
  String get verifyAndPrepare => '验证并准备恢复';

  @override
  String get backupVerified => '备份已验证';

  @override
  String get backupVerifiedBody => '恢复已准备就绪。请关闭 Aurora 并重新打开；重启前的新增操作会被备份覆盖。';

  @override
  String get gotIt => '知道了';

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
  String get about => '关于';

  @override
  String get aboutAurora => '关于 Aurora';

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
  String get noFeedsYet => '还没有订阅源';

  @override
  String get addFeed => '添加订阅';

  @override
  String get addSubscription => '添加订阅';

  @override
  String get addFeedTitle => '添加订阅';

  @override
  String get addFeedHint => '粘贴 RSS、Atom、播客或带订阅链接的网页地址';

  @override
  String get feedAddressLabel => '订阅地址';

  @override
  String get feedAddressHintText => 'https://example.com/feed.xml';

  @override
  String get groupLabel => '分组';

  @override
  String get ungrouped => '未分组';

  @override
  String get fetchAndAdd => '获取并添加';

  @override
  String get feedAddressRequired => '请输入订阅地址';

  @override
  String get feedAddressInvalid => '请输入完整的 http:// 或 https:// 地址';

  @override
  String get addingInProgress => '正在获取并解析订阅…\n如果是网页，将尝试发现其中的订阅链接。';

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
  String get all => '全部';

  @override
  String get unread => '未读';

  @override
  String get groups => '分组';

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
    return '$count 篇未读';
  }

  @override
  String feedUnreadAndStatus(int count, String status) {
    return '$count 篇未读 · $status';
  }

  @override
  String get lastRefreshFailed => '上次刷新失败';

  @override
  String get notRefreshedYet => '尚未刷新';

  @override
  String get refreshed => '已刷新';

  @override
  String get refreshThisFeed => '刷新这个订阅';

  @override
  String get moreActions => '更多操作';

  @override
  String lastCheck(String time) {
    return '上次检查：$time';
  }

  @override
  String get savedEmpty => '暂无收藏文章';

  @override
  String get savedHint => '收藏喜欢的文章，方便以后回看';

  @override
  String savedCount(int count) {
    return '已收藏 $count 篇';
  }

  @override
  String get selectArticle => '选择一篇文章开始阅读';

  @override
  String get sharePreview => '分享预览';

  @override
  String get cardSummary => '图文摘要';

  @override
  String get cardSummaryHint => '确认排版后分享图片，二维码指向文章原文。';

  @override
  String get updatePreview => '更新预览';

  @override
  String get shareThisImage => '分享这张图片';

  @override
  String get contentModified => '内容已修改，请先更新预览。';

  @override
  String get includeImage => '包含配图';

  @override
  String get articleImage => '文章配图';

  @override
  String get chooseImage => '选择分享配图';

  @override
  String get chooseImageHint => '图片会等比完整显示。选择后点“使用此配图”，预览会自动更新。';

  @override
  String get useThisImage => '使用此配图';

  @override
  String get textOnlyCard => '纯文字卡片';

  @override
  String get noImage => '不包含文章图片';

  @override
  String get imageUnavailable => '这张图片暂时无法读取，预览已使用纯文字；可以换一张图片。';

  @override
  String get shareExcerpt => '分享摘要';

  @override
  String get excerptHint => '卡片最多展示六行，较长内容会省略。';

  @override
  String get previewFailed => '预览生成失败，请重试';

  @override
  String get shareSaveFailed => '无法保存图片或打开系统分享面板，请重试';

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
