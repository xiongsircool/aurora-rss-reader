import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_zh.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'generated/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('zh'),
  ];

  /// No description provided for @tabInbox.
  ///
  /// In zh, this message translates to:
  /// **'收件箱'**
  String get tabInbox;

  /// No description provided for @tabSaved.
  ///
  /// In zh, this message translates to:
  /// **'收藏'**
  String get tabSaved;

  /// No description provided for @tabSources.
  ///
  /// In zh, this message translates to:
  /// **'订阅'**
  String get tabSources;

  /// No description provided for @tabSettings.
  ///
  /// In zh, this message translates to:
  /// **'设置'**
  String get tabSettings;

  /// No description provided for @inboxEmpty.
  ///
  /// In zh, this message translates to:
  /// **'收件箱为空'**
  String get inboxEmpty;

  /// No description provided for @inboxNoUnread.
  ///
  /// In zh, this message translates to:
  /// **'没有未读文章'**
  String get inboxNoUnread;

  /// No description provided for @inboxNoEntriesYet.
  ///
  /// In zh, this message translates to:
  /// **'还没有获取到文章'**
  String get inboxNoEntriesYet;

  /// No description provided for @greetingLateNight.
  ///
  /// In zh, this message translates to:
  /// **'夜深了'**
  String get greetingLateNight;

  /// No description provided for @greetingMorning.
  ///
  /// In zh, this message translates to:
  /// **'早上好'**
  String get greetingMorning;

  /// No description provided for @greetingNoon.
  ///
  /// In zh, this message translates to:
  /// **'中午好'**
  String get greetingNoon;

  /// No description provided for @greetingAfternoon.
  ///
  /// In zh, this message translates to:
  /// **'下午好'**
  String get greetingAfternoon;

  /// No description provided for @greetingEvening.
  ///
  /// In zh, this message translates to:
  /// **'晚上好'**
  String get greetingEvening;

  /// No description provided for @allRead.
  ///
  /// In zh, this message translates to:
  /// **'已全部读完'**
  String get allRead;

  /// No description provided for @unreadCount.
  ///
  /// In zh, this message translates to:
  /// **'{count} 篇未读'**
  String unreadCount(int count);

  /// No description provided for @filter.
  ///
  /// In zh, this message translates to:
  /// **'筛选'**
  String get filter;

  /// No description provided for @search.
  ///
  /// In zh, this message translates to:
  /// **'搜索'**
  String get search;

  /// No description provided for @searchArticles.
  ///
  /// In zh, this message translates to:
  /// **'搜索本地文章'**
  String get searchArticles;

  /// No description provided for @searchHint.
  ///
  /// In zh, this message translates to:
  /// **'搜索标题和正文'**
  String get searchHint;

  /// No description provided for @searchSearching.
  ///
  /// In zh, this message translates to:
  /// **'正在搜索…'**
  String get searchSearching;

  /// No description provided for @searchFailed.
  ///
  /// In zh, this message translates to:
  /// **'搜索失败，请重试'**
  String get searchFailed;

  /// No description provided for @searchRetry.
  ///
  /// In zh, this message translates to:
  /// **'重试'**
  String get searchRetry;

  /// No description provided for @searchNoMatch.
  ///
  /// In zh, this message translates to:
  /// **'没有匹配文章'**
  String get searchNoMatch;

  /// No description provided for @searchNoMatchHint.
  ///
  /// In zh, this message translates to:
  /// **'试试更短的关键词'**
  String get searchNoMatchHint;

  /// No description provided for @searchResultsCount.
  ///
  /// In zh, this message translates to:
  /// **'显示 {count} 条匹配结果'**
  String searchResultsCount(int count);

  /// No description provided for @refreshAll.
  ///
  /// In zh, this message translates to:
  /// **'刷新全部订阅'**
  String get refreshAll;

  /// No description provided for @refreshingProgress.
  ///
  /// In zh, this message translates to:
  /// **'正在刷新 {done}/{total}'**
  String refreshingProgress(int done, int total);

  /// No description provided for @refreshDone.
  ///
  /// In zh, this message translates to:
  /// **'刷新完成，新增 {count} 篇文章'**
  String refreshDone(int count);

  /// No description provided for @refreshDoneWithFailures.
  ///
  /// In zh, this message translates to:
  /// **'刷新完成，新增 {count} 篇，{failed} 个订阅失败'**
  String refreshDoneWithFailures(int count, int failed);

  /// No description provided for @retryFailedSubs.
  ///
  /// In zh, this message translates to:
  /// **'重试失败的订阅'**
  String get retryFailedSubs;

  /// No description provided for @retryStillFailing.
  ///
  /// In zh, this message translates to:
  /// **'重试后仍有 {count} 个订阅失败'**
  String retryStillFailing(int count);

  /// No description provided for @viewDetails.
  ///
  /// In zh, this message translates to:
  /// **'查看'**
  String get viewDetails;

  /// No description provided for @refreshDetails.
  ///
  /// In zh, this message translates to:
  /// **'刷新详情'**
  String get refreshDetails;

  /// No description provided for @noFailedFeeds.
  ///
  /// In zh, this message translates to:
  /// **'没有需要重试的订阅'**
  String get noFailedFeeds;

  /// No description provided for @close.
  ///
  /// In zh, this message translates to:
  /// **'关闭'**
  String get close;

  /// No description provided for @cancel.
  ///
  /// In zh, this message translates to:
  /// **'取消'**
  String get cancel;

  /// No description provided for @apply.
  ///
  /// In zh, this message translates to:
  /// **'应用'**
  String get apply;

  /// No description provided for @save.
  ///
  /// In zh, this message translates to:
  /// **'保存'**
  String get save;

  /// No description provided for @confirm.
  ///
  /// In zh, this message translates to:
  /// **'确定'**
  String get confirm;

  /// No description provided for @delete.
  ///
  /// In zh, this message translates to:
  /// **'删除'**
  String get delete;

  /// No description provided for @retry.
  ///
  /// In zh, this message translates to:
  /// **'重试'**
  String get retry;

  /// No description provided for @loadMore.
  ///
  /// In zh, this message translates to:
  /// **'加载更多'**
  String get loadMore;

  /// No description provided for @loadingMore.
  ///
  /// In zh, this message translates to:
  /// **'正在加载…'**
  String get loadingMore;

  /// No description provided for @loadMoreFailed.
  ///
  /// In zh, this message translates to:
  /// **'加载失败，点击重试'**
  String get loadMoreFailed;

  /// No description provided for @loadedSoFar.
  ///
  /// In zh, this message translates to:
  /// **'已加载 {count} 篇，继续加载'**
  String loadedSoFar(int count);

  /// No description provided for @markRead.
  ///
  /// In zh, this message translates to:
  /// **'标为已读'**
  String get markRead;

  /// No description provided for @markUnread.
  ///
  /// In zh, this message translates to:
  /// **'标为未读'**
  String get markUnread;

  /// No description provided for @markAllRead.
  ///
  /// In zh, this message translates to:
  /// **'全部标为已读'**
  String get markAllRead;

  /// No description provided for @star.
  ///
  /// In zh, this message translates to:
  /// **'收藏'**
  String get star;

  /// No description provided for @unstar.
  ///
  /// In zh, this message translates to:
  /// **'取消收藏'**
  String get unstar;

  /// No description provided for @justNow.
  ///
  /// In zh, this message translates to:
  /// **'刚刚'**
  String get justNow;

  /// No description provided for @minutesAgo.
  ///
  /// In zh, this message translates to:
  /// **'{count}分钟前'**
  String minutesAgo(int count);

  /// No description provided for @hoursAgo.
  ///
  /// In zh, this message translates to:
  /// **'{count}小时前'**
  String hoursAgo(int count);

  /// No description provided for @yesterday.
  ///
  /// In zh, this message translates to:
  /// **'昨天'**
  String get yesterday;

  /// No description provided for @daysAgo.
  ///
  /// In zh, this message translates to:
  /// **'{count}天前'**
  String daysAgo(int count);

  /// No description provided for @dateMD.
  ///
  /// In zh, this message translates to:
  /// **'{month}月{day}日'**
  String dateMD(int month, int day);

  /// No description provided for @dateYMD.
  ///
  /// In zh, this message translates to:
  /// **'{year}年{month}月{day}日'**
  String dateYMD(int year, int month, int day);

  /// No description provided for @readerSettings.
  ///
  /// In zh, this message translates to:
  /// **'阅读设置'**
  String get readerSettings;

  /// No description provided for @fontSize.
  ///
  /// In zh, this message translates to:
  /// **'字号'**
  String get fontSize;

  /// No description provided for @lineHeight.
  ///
  /// In zh, this message translates to:
  /// **'行距'**
  String get lineHeight;

  /// No description provided for @fontFamily.
  ///
  /// In zh, this message translates to:
  /// **'字体'**
  String get fontFamily;

  /// No description provided for @fontSans.
  ///
  /// In zh, this message translates to:
  /// **'系统默认'**
  String get fontSans;

  /// No description provided for @fontSerif.
  ///
  /// In zh, this message translates to:
  /// **'衬线'**
  String get fontSerif;

  /// No description provided for @share.
  ///
  /// In zh, this message translates to:
  /// **'分享'**
  String get share;

  /// No description provided for @shareCard.
  ///
  /// In zh, this message translates to:
  /// **'分享卡片'**
  String get shareCard;

  /// No description provided for @shareLink.
  ///
  /// In zh, this message translates to:
  /// **'复制链接'**
  String get shareLink;

  /// No description provided for @shareText.
  ///
  /// In zh, this message translates to:
  /// **'分享文本'**
  String get shareText;

  /// No description provided for @shareMarkdown.
  ///
  /// In zh, this message translates to:
  /// **'分享 Markdown'**
  String get shareMarkdown;

  /// No description provided for @shareScreenshot.
  ///
  /// In zh, this message translates to:
  /// **'分享截图'**
  String get shareScreenshot;

  /// No description provided for @linkCopied.
  ///
  /// In zh, this message translates to:
  /// **'链接已复制'**
  String get linkCopied;

  /// No description provided for @copyCode.
  ///
  /// In zh, this message translates to:
  /// **'复制代码'**
  String get copyCode;

  /// No description provided for @codeCopied.
  ///
  /// In zh, this message translates to:
  /// **'代码已复制'**
  String get codeCopied;

  /// No description provided for @translateTitle.
  ///
  /// In zh, this message translates to:
  /// **'翻译标题'**
  String get translateTitle;

  /// No description provided for @translatingTitle.
  ///
  /// In zh, this message translates to:
  /// **'翻译标题中…'**
  String get translatingTitle;

  /// No description provided for @aiSummary.
  ///
  /// In zh, this message translates to:
  /// **'AI 摘要'**
  String get aiSummary;

  /// No description provided for @aiSummaryFailed.
  ///
  /// In zh, this message translates to:
  /// **'AI 摘要失败：{message}'**
  String aiSummaryFailed(String message);

  /// No description provided for @aiNotConfigured.
  ///
  /// In zh, this message translates to:
  /// **'AI 未配置'**
  String get aiNotConfigured;

  /// No description provided for @aiTimeout.
  ///
  /// In zh, this message translates to:
  /// **'AI 请求超时'**
  String get aiTimeout;

  /// No description provided for @regenerate.
  ///
  /// In zh, this message translates to:
  /// **'重新生成'**
  String get regenerate;

  /// No description provided for @summaryGenerating.
  ///
  /// In zh, this message translates to:
  /// **'摘要生成中'**
  String get summaryGenerating;

  /// No description provided for @translateArticle.
  ///
  /// In zh, this message translates to:
  /// **'翻译全文'**
  String get translateArticle;

  /// No description provided for @translatingProgress.
  ///
  /// In zh, this message translates to:
  /// **'翻译中 · {percent}%'**
  String translatingProgress(int percent);

  /// No description provided for @extractFullText.
  ///
  /// In zh, this message translates to:
  /// **'提取网页全文'**
  String get extractFullText;

  /// No description provided for @extracting.
  ///
  /// In zh, this message translates to:
  /// **'正在提取'**
  String get extracting;

  /// No description provided for @extractFailedPrefix.
  ///
  /// In zh, this message translates to:
  /// **'提取失败：'**
  String get extractFailedPrefix;

  /// No description provided for @noBodyUseOriginal.
  ///
  /// In zh, this message translates to:
  /// **'该订阅没有提供正文，请打开原文阅读。'**
  String get noBodyUseOriginal;

  /// No description provided for @videoHint.
  ///
  /// In zh, this message translates to:
  /// **'视频内容请点击下方卡片观看。'**
  String get videoHint;

  /// No description provided for @webpageHint.
  ///
  /// In zh, this message translates to:
  /// **'该地址返回的是网页而非订阅源，站点可能已停用 RSS'**
  String get webpageHint;

  /// No description provided for @showSubscriptionContent.
  ///
  /// In zh, this message translates to:
  /// **'显示订阅原文'**
  String get showSubscriptionContent;

  /// No description provided for @fullTextCached.
  ///
  /// In zh, this message translates to:
  /// **'网页全文已缓存'**
  String get fullTextCached;

  /// No description provided for @openOriginal.
  ///
  /// In zh, this message translates to:
  /// **'打开原文'**
  String get openOriginal;

  /// No description provided for @playAudio.
  ///
  /// In zh, this message translates to:
  /// **'播放音频'**
  String get playAudio;

  /// No description provided for @openPlayer.
  ///
  /// In zh, this message translates to:
  /// **'打开播放器'**
  String get openPlayer;

  /// No description provided for @playing.
  ///
  /// In zh, this message translates to:
  /// **'正在播放'**
  String get playing;

  /// No description provided for @paused.
  ///
  /// In zh, this message translates to:
  /// **'已暂停'**
  String get paused;

  /// No description provided for @audioLoading.
  ///
  /// In zh, this message translates to:
  /// **'正在加载音频…'**
  String get audioLoading;

  /// No description provided for @audioBuffering.
  ///
  /// In zh, this message translates to:
  /// **'正在缓冲…'**
  String get audioBuffering;

  /// No description provided for @audioCompleted.
  ///
  /// In zh, this message translates to:
  /// **'已播放完毕'**
  String get audioCompleted;

  /// No description provided for @audioFailed.
  ///
  /// In zh, this message translates to:
  /// **'音频暂时无法加载，请检查网络后重试'**
  String get audioFailed;

  /// No description provided for @audioRetry.
  ///
  /// In zh, this message translates to:
  /// **'重新加载'**
  String get audioRetry;

  /// No description provided for @speedLabel.
  ///
  /// In zh, this message translates to:
  /// **'播放速度'**
  String get speedLabel;

  /// No description provided for @playbackResumed.
  ///
  /// In zh, this message translates to:
  /// **'已恢复上次进度'**
  String get playbackResumed;

  /// No description provided for @playbackResumedShort.
  ///
  /// In zh, this message translates to:
  /// **'已恢复到上次播放位置'**
  String get playbackResumedShort;

  /// No description provided for @back10.
  ///
  /// In zh, this message translates to:
  /// **'后退 10 秒'**
  String get back10;

  /// No description provided for @forward30.
  ///
  /// In zh, this message translates to:
  /// **'前进 30 秒'**
  String get forward30;

  /// No description provided for @replay.
  ///
  /// In zh, this message translates to:
  /// **'重新播放'**
  String get replay;

  /// No description provided for @pauseAudio.
  ///
  /// In zh, this message translates to:
  /// **'暂停音频'**
  String get pauseAudio;

  /// No description provided for @retryAudio.
  ///
  /// In zh, this message translates to:
  /// **'重试音频'**
  String get retryAudio;

  /// No description provided for @playAudioSemantics.
  ///
  /// In zh, this message translates to:
  /// **'播放音频'**
  String get playAudioSemantics;

  /// No description provided for @pauseAudioSemantics.
  ///
  /// In zh, this message translates to:
  /// **'暂停音频'**
  String get pauseAudioSemantics;

  /// No description provided for @stopAndClose.
  ///
  /// In zh, this message translates to:
  /// **'停止播放并关闭'**
  String get stopAndClose;

  /// No description provided for @collapseKeepPlaying.
  ///
  /// In zh, this message translates to:
  /// **'收起播放器，继续播放'**
  String get collapseKeepPlaying;

  /// No description provided for @backgroundPlayNote.
  ///
  /// In zh, this message translates to:
  /// **'收起后可继续浏览文章。当前支持应用内持续播放，离开应用时会暂停。'**
  String get backgroundPlayNote;

  /// No description provided for @seekFailed.
  ///
  /// In zh, this message translates to:
  /// **'跳转失败，请重试'**
  String get seekFailed;

  /// No description provided for @pauseInterrupted.
  ///
  /// In zh, this message translates to:
  /// **'暂时无法暂停，请关闭播放条'**
  String get pauseInterrupted;

  /// No description provided for @playInterrupted.
  ///
  /// In zh, this message translates to:
  /// **'播放中断，请重试'**
  String get playInterrupted;

  /// No description provided for @settings.
  ///
  /// In zh, this message translates to:
  /// **'设置'**
  String get settings;

  /// No description provided for @readingAndAppearance.
  ///
  /// In zh, this message translates to:
  /// **'阅读与外观'**
  String get readingAndAppearance;

  /// No description provided for @readerLayout.
  ///
  /// In zh, this message translates to:
  /// **'阅读排版'**
  String get readerLayout;

  /// No description provided for @readerLayoutHint.
  ///
  /// In zh, this message translates to:
  /// **'在文章右上角调整字号、行距和字体，设置会自动保存。'**
  String get readerLayoutHint;

  /// No description provided for @theme.
  ///
  /// In zh, this message translates to:
  /// **'深浅主题'**
  String get theme;

  /// No description provided for @themeFollowSystem.
  ///
  /// In zh, this message translates to:
  /// **'跟随系统外观'**
  String get themeFollowSystem;

  /// No description provided for @feedsAndNetwork.
  ///
  /// In zh, this message translates to:
  /// **'订阅与网络'**
  String get feedsAndNetwork;

  /// No description provided for @networkProxy.
  ///
  /// In zh, this message translates to:
  /// **'网络代理'**
  String get networkProxy;

  /// No description provided for @proxyDirect.
  ///
  /// In zh, this message translates to:
  /// **'直连'**
  String get proxyDirect;

  /// No description provided for @proxyHint.
  ///
  /// In zh, this message translates to:
  /// **'留空则使用直连。'**
  String get proxyHint;

  /// No description provided for @proxyAddressHint.
  ///
  /// In zh, this message translates to:
  /// **'代理地址格式应为 host:port 或 http://host:port'**
  String get proxyAddressHint;

  /// No description provided for @proxySaved.
  ///
  /// In zh, this message translates to:
  /// **'代理设置已保存'**
  String get proxySaved;

  /// No description provided for @proxySaveFailed.
  ///
  /// In zh, this message translates to:
  /// **'保存代理设置失败：{error}'**
  String proxySaveFailed(String error);

  /// No description provided for @httpProxy.
  ///
  /// In zh, this message translates to:
  /// **'HTTP 代理'**
  String get httpProxy;

  /// No description provided for @backgroundRefresh.
  ///
  /// In zh, this message translates to:
  /// **'后台刷新'**
  String get backgroundRefresh;

  /// No description provided for @backgroundRefreshOff.
  ///
  /// In zh, this message translates to:
  /// **'已关闭'**
  String get backgroundRefreshOff;

  /// No description provided for @backgroundRefreshEvery.
  ///
  /// In zh, this message translates to:
  /// **'约每 {hours} 小时，执行时间由系统安排'**
  String backgroundRefreshEvery(int hours);

  /// No description provided for @refreshIntervalTitle.
  ///
  /// In zh, this message translates to:
  /// **'后台刷新间隔'**
  String get refreshIntervalTitle;

  /// No description provided for @refreshIntervalHint.
  ///
  /// In zh, this message translates to:
  /// **'这是后台检查订阅的目标间隔，不影响手动刷新。iOS 会根据使用习惯、电量和网络决定实际执行时间，并非定时闹钟。'**
  String get refreshIntervalHint;

  /// No description provided for @everyHours.
  ///
  /// In zh, this message translates to:
  /// **'每 {hours} 小时'**
  String everyHours(int hours);

  /// No description provided for @hoursSuffix.
  ///
  /// In zh, this message translates to:
  /// **'{hours} 小时'**
  String hoursSuffix(int hours);

  /// No description provided for @turnOff.
  ///
  /// In zh, this message translates to:
  /// **'关闭后台刷新'**
  String get turnOff;

  /// No description provided for @keepManualRefresh.
  ///
  /// In zh, this message translates to:
  /// **'保留手动刷新功能'**
  String get keepManualRefresh;

  /// No description provided for @defaultInterval.
  ///
  /// In zh, this message translates to:
  /// **'默认间隔'**
  String get defaultInterval;

  /// No description provided for @batteryExemption.
  ///
  /// In zh, this message translates to:
  /// **'电池优化豁免'**
  String get batteryExemption;

  /// No description provided for @batteryExemptionHint.
  ///
  /// In zh, this message translates to:
  /// **'前往系统设置调整后台限制'**
  String get batteryExemptionHint;

  /// No description provided for @batteryExemptionBody.
  ///
  /// In zh, this message translates to:
  /// **'前往系统设置调整后台限制'**
  String get batteryExemptionBody;

  /// No description provided for @opmlImportExport.
  ///
  /// In zh, this message translates to:
  /// **'OPML 导入与导出'**
  String get opmlImportExport;

  /// No description provided for @opmlHint.
  ///
  /// In zh, this message translates to:
  /// **'迁移订阅列表，不包含文章、收藏和阅读记录'**
  String get opmlHint;

  /// No description provided for @opmlImport.
  ///
  /// In zh, this message translates to:
  /// **'导入 OPML'**
  String get opmlImport;

  /// No description provided for @opmlExport.
  ///
  /// In zh, this message translates to:
  /// **'导出 OPML'**
  String get opmlExport;

  /// No description provided for @aiService.
  ///
  /// In zh, this message translates to:
  /// **'AI 服务'**
  String get aiService;

  /// No description provided for @aiConfiguredWith.
  ///
  /// In zh, this message translates to:
  /// **'已配置 · {model}'**
  String aiConfiguredWith(String model);

  /// No description provided for @aiConnection.
  ///
  /// In zh, this message translates to:
  /// **'服务连接'**
  String get aiConnection;

  /// No description provided for @aiConnectionHint.
  ///
  /// In zh, this message translates to:
  /// **'端点 · 模型 · API Key'**
  String get aiConnectionHint;

  /// No description provided for @aiEndpoint.
  ///
  /// In zh, this message translates to:
  /// **'API 端点'**
  String get aiEndpoint;

  /// No description provided for @aiModelId.
  ///
  /// In zh, this message translates to:
  /// **'模型 ID'**
  String get aiModelId;

  /// No description provided for @aiTimeoutTokens.
  ///
  /// In zh, this message translates to:
  /// **'超时 · 重试 · 输出语言'**
  String get aiTimeoutTokens;

  /// No description provided for @aiThinkingSupport.
  ///
  /// In zh, this message translates to:
  /// **'支持推理/思考'**
  String get aiThinkingSupport;

  /// No description provided for @aiThinkingNotSupported.
  ///
  /// In zh, this message translates to:
  /// **'模型不支持 extended thinking'**
  String get aiThinkingNotSupported;

  /// No description provided for @aiTestConnection.
  ///
  /// In zh, this message translates to:
  /// **'测试连接'**
  String get aiTestConnection;

  /// No description provided for @aiConnectionTestSent.
  ///
  /// In zh, this message translates to:
  /// **'连接测试已发送…'**
  String get aiConnectionTestSent;

  /// No description provided for @aiNotConfiguredMsg.
  ///
  /// In zh, this message translates to:
  /// **'请先在设置中配置 AI 服务'**
  String get aiNotConfiguredMsg;

  /// No description provided for @aiEndpointNotConfigured.
  ///
  /// In zh, this message translates to:
  /// **'请先在设置中配置 AI 服务端点和 Key'**
  String get aiEndpointNotConfigured;

  /// No description provided for @aiEndpointEmpty.
  ///
  /// In zh, this message translates to:
  /// **'请先填写端点'**
  String get aiEndpointEmpty;

  /// No description provided for @dataAndBackup.
  ///
  /// In zh, this message translates to:
  /// **'数据与备份'**
  String get dataAndBackup;

  /// No description provided for @localData.
  ///
  /// In zh, this message translates to:
  /// **'本地数据'**
  String get localData;

  /// No description provided for @statsLoading.
  ///
  /// In zh, this message translates to:
  /// **'正在读取统计…'**
  String get statsLoading;

  /// No description provided for @statsError.
  ///
  /// In zh, this message translates to:
  /// **'暂时无法读取统计'**
  String get statsError;

  /// No description provided for @readingStats.
  ///
  /// In zh, this message translates to:
  /// **'{feeds} 个订阅 · {total} 篇文章'**
  String readingStats(int feeds, int total);

  /// No description provided for @statsDetail.
  ///
  /// In zh, this message translates to:
  /// **'已读 {read} · 收藏 {starred}'**
  String statsDetail(int read, int starred);

  /// No description provided for @backupAll.
  ///
  /// In zh, this message translates to:
  /// **'备份全部数据'**
  String get backupAll;

  /// No description provided for @backupAllHint.
  ///
  /// In zh, this message translates to:
  /// **'导出设备中的数据库，API Key 需单独保管'**
  String get backupAllHint;

  /// No description provided for @backupFile.
  ///
  /// In zh, this message translates to:
  /// **'Aurora 数据备份'**
  String get backupFile;

  /// No description provided for @backupFailed.
  ///
  /// In zh, this message translates to:
  /// **'备份失败：{error}'**
  String backupFailed(String error);

  /// No description provided for @backupDuringRefresh.
  ///
  /// In zh, this message translates to:
  /// **'刷新中无法备份，请稍后再试'**
  String get backupDuringRefresh;

  /// No description provided for @restoreBackup.
  ///
  /// In zh, this message translates to:
  /// **'恢复备份'**
  String get restoreBackup;

  /// No description provided for @restoreHint.
  ///
  /// In zh, this message translates to:
  /// **'恢复将替换当前数据，请先保留当前备份'**
  String get restoreHint;

  /// No description provided for @replaceCurrentData.
  ///
  /// In zh, this message translates to:
  /// **'替换当前数据？'**
  String get replaceCurrentData;

  /// No description provided for @replaceCurrentDataBody.
  ///
  /// In zh, this message translates to:
  /// **'恢复会覆盖当前订阅、文章和阅读记录。请先导出当前备份；API Key 不会随备份迁移。'**
  String get replaceCurrentDataBody;

  /// No description provided for @verifyAndPrepare.
  ///
  /// In zh, this message translates to:
  /// **'验证并准备恢复'**
  String get verifyAndPrepare;

  /// No description provided for @backupVerified.
  ///
  /// In zh, this message translates to:
  /// **'备份已验证'**
  String get backupVerified;

  /// No description provided for @backupVerifiedBody.
  ///
  /// In zh, this message translates to:
  /// **'恢复已准备就绪。请关闭 Aurora 并重新打开；重启前的新增操作会被备份覆盖。'**
  String get backupVerifiedBody;

  /// No description provided for @gotIt.
  ///
  /// In zh, this message translates to:
  /// **'知道了'**
  String get gotIt;

  /// No description provided for @backupInvalid.
  ///
  /// In zh, this message translates to:
  /// **'不是有效的 Aurora 备份文件'**
  String get backupInvalid;

  /// No description provided for @backupCorrupt.
  ///
  /// In zh, this message translates to:
  /// **'备份文件损坏：清单长度异常'**
  String get backupCorrupt;

  /// No description provided for @backupSourceMismatch.
  ///
  /// In zh, this message translates to:
  /// **'备份文件来源不符'**
  String get backupSourceMismatch;

  /// No description provided for @backupReadFailed.
  ///
  /// In zh, this message translates to:
  /// **'备份读取或验证失败，请确认文件完整且与此版本兼容'**
  String get backupReadFailed;

  /// No description provided for @backupNewerVersion.
  ///
  /// In zh, this message translates to:
  /// **'备份来自更新版本的 App（数据结构 {userVersion} > {currentVersion}），请先升级应用'**
  String backupNewerVersion(int userVersion, int currentVersion);

  /// No description provided for @about.
  ///
  /// In zh, this message translates to:
  /// **'关于'**
  String get about;

  /// No description provided for @aboutAurora.
  ///
  /// In zh, this message translates to:
  /// **'关于 Aurora'**
  String get aboutAurora;

  /// No description provided for @aboutPrivacy.
  ///
  /// In zh, this message translates to:
  /// **'隐私'**
  String get aboutPrivacy;

  /// No description provided for @aboutPrivacyBody.
  ///
  /// In zh, this message translates to:
  /// **'Aurora 采用本地优先架构：你的订阅、文章、阅读记录与 AI 设置（包括 API Key）全部只保存在这台设备上的本地数据库中，没有任何账号系统，也不会上传到任何服务器。仅在你主动刷新订阅或请求 AI 服务时，才会访问你配置的地址。'**
  String get aboutPrivacyBody;

  /// No description provided for @aboutLinks.
  ///
  /// In zh, this message translates to:
  /// **'链接'**
  String get aboutLinks;

  /// No description provided for @aboutRepo.
  ///
  /// In zh, this message translates to:
  /// **'项目主页（GitHub）'**
  String get aboutRepo;

  /// No description provided for @aboutRepoSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'开源 · GPL-3.0'**
  String get aboutRepoSubtitle;

  /// No description provided for @aboutFeedback.
  ///
  /// In zh, this message translates to:
  /// **'问题反馈'**
  String get aboutFeedback;

  /// No description provided for @aboutFeedbackSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'提交 Issue 帮助改进'**
  String get aboutFeedbackSubtitle;

  /// No description provided for @aboutLicense.
  ///
  /// In zh, this message translates to:
  /// **'开源许可'**
  String get aboutLicense;

  /// No description provided for @aboutLicenseSubtitle.
  ///
  /// In zh, this message translates to:
  /// **'本软件使用的第三方组件许可'**
  String get aboutLicenseSubtitle;

  /// No description provided for @aboutCopyright.
  ///
  /// In zh, this message translates to:
  /// **'© 2026 Aurora · 以 GPLv3 协议开源'**
  String get aboutCopyright;

  /// No description provided for @aboutTagline.
  ///
  /// In zh, this message translates to:
  /// **'本地优先的 RSS 阅读器'**
  String get aboutTagline;

  /// No description provided for @sponsorGithub.
  ///
  /// In zh, this message translates to:
  /// **'GitHub Sponsors 赞助'**
  String get sponsorGithub;

  /// No description provided for @sponsorTitle.
  ///
  /// In zh, this message translates to:
  /// **'支持开发者'**
  String get sponsorTitle;

  /// No description provided for @noFeedsYet.
  ///
  /// In zh, this message translates to:
  /// **'还没有订阅源'**
  String get noFeedsYet;

  /// No description provided for @addFeed.
  ///
  /// In zh, this message translates to:
  /// **'添加订阅'**
  String get addFeed;

  /// No description provided for @addSubscription.
  ///
  /// In zh, this message translates to:
  /// **'添加订阅'**
  String get addSubscription;

  /// No description provided for @addFeedTitle.
  ///
  /// In zh, this message translates to:
  /// **'添加订阅'**
  String get addFeedTitle;

  /// No description provided for @addFeedHint.
  ///
  /// In zh, this message translates to:
  /// **'粘贴 RSS、Atom、播客或带订阅链接的网页地址'**
  String get addFeedHint;

  /// No description provided for @feedAddressLabel.
  ///
  /// In zh, this message translates to:
  /// **'订阅地址'**
  String get feedAddressLabel;

  /// No description provided for @feedAddressHintText.
  ///
  /// In zh, this message translates to:
  /// **'https://example.com/feed.xml'**
  String get feedAddressHintText;

  /// No description provided for @groupLabel.
  ///
  /// In zh, this message translates to:
  /// **'分组'**
  String get groupLabel;

  /// No description provided for @ungrouped.
  ///
  /// In zh, this message translates to:
  /// **'未分组'**
  String get ungrouped;

  /// No description provided for @fetchAndAdd.
  ///
  /// In zh, this message translates to:
  /// **'获取并添加'**
  String get fetchAndAdd;

  /// No description provided for @feedAddressRequired.
  ///
  /// In zh, this message translates to:
  /// **'请输入订阅地址'**
  String get feedAddressRequired;

  /// No description provided for @feedAddressInvalid.
  ///
  /// In zh, this message translates to:
  /// **'请输入完整的 http:// 或 https:// 地址'**
  String get feedAddressInvalid;

  /// No description provided for @addingInProgress.
  ///
  /// In zh, this message translates to:
  /// **'正在获取并解析订阅…\n如果是网页，将尝试发现其中的订阅链接。'**
  String get addingInProgress;

  /// No description provided for @addFailedNetwork.
  ///
  /// In zh, this message translates to:
  /// **'添加订阅失败：{reason}（站点可能无法从当前网络访问）'**
  String addFailedNetwork(String reason);

  /// No description provided for @feedUpToDate.
  ///
  /// In zh, this message translates to:
  /// **'{title} 已是最新状态'**
  String feedUpToDate(String title);

  /// No description provided for @feedAdded.
  ///
  /// In zh, this message translates to:
  /// **'已添加 {title}，获取 {count} 篇文章'**
  String feedAdded(String title, int count);

  /// No description provided for @all.
  ///
  /// In zh, this message translates to:
  /// **'全部'**
  String get all;

  /// No description provided for @unread.
  ///
  /// In zh, this message translates to:
  /// **'未读'**
  String get unread;

  /// No description provided for @groups.
  ///
  /// In zh, this message translates to:
  /// **'分组'**
  String get groups;

  /// No description provided for @newGroupName.
  ///
  /// In zh, this message translates to:
  /// **'新分组名称'**
  String get newGroupName;

  /// No description provided for @newGroupEllipsis.
  ///
  /// In zh, this message translates to:
  /// **'新建分组…'**
  String get newGroupEllipsis;

  /// No description provided for @moveToGroup.
  ///
  /// In zh, this message translates to:
  /// **'移动到分组'**
  String get moveToGroup;

  /// No description provided for @groupMoved.
  ///
  /// In zh, this message translates to:
  /// **'「{title}」已移动到 {group}'**
  String groupMoved(String title, String group);

  /// No description provided for @groupRenamed.
  ///
  /// In zh, this message translates to:
  /// **'分组已重命名为 {name}'**
  String groupRenamed(String name);

  /// No description provided for @groupDeleteConfirm.
  ///
  /// In zh, this message translates to:
  /// **'“{title}”及其本地文章将被删除。'**
  String groupDeleteConfirm(String title);

  /// No description provided for @deleteSubscription.
  ///
  /// In zh, this message translates to:
  /// **'删除订阅'**
  String get deleteSubscription;

  /// No description provided for @deleteSubscriptionConfirm.
  ///
  /// In zh, this message translates to:
  /// **'删除订阅？'**
  String get deleteSubscriptionConfirm;

  /// No description provided for @subscriptionDeleted.
  ///
  /// In zh, this message translates to:
  /// **'已删除 {title}'**
  String subscriptionDeleted(String title);

  /// No description provided for @unreadEntries.
  ///
  /// In zh, this message translates to:
  /// **'{count} 篇未读'**
  String unreadEntries(int count);

  /// No description provided for @feedUnreadAndStatus.
  ///
  /// In zh, this message translates to:
  /// **'{count} 篇未读 · {status}'**
  String feedUnreadAndStatus(int count, String status);

  /// No description provided for @lastRefreshFailed.
  ///
  /// In zh, this message translates to:
  /// **'上次刷新失败'**
  String get lastRefreshFailed;

  /// No description provided for @notRefreshedYet.
  ///
  /// In zh, this message translates to:
  /// **'尚未刷新'**
  String get notRefreshedYet;

  /// No description provided for @refreshed.
  ///
  /// In zh, this message translates to:
  /// **'已刷新'**
  String get refreshed;

  /// No description provided for @refreshThisFeed.
  ///
  /// In zh, this message translates to:
  /// **'刷新这个订阅'**
  String get refreshThisFeed;

  /// No description provided for @moreActions.
  ///
  /// In zh, this message translates to:
  /// **'更多操作'**
  String get moreActions;

  /// No description provided for @lastCheck.
  ///
  /// In zh, this message translates to:
  /// **'上次检查：{time}'**
  String lastCheck(String time);

  /// No description provided for @savedEmpty.
  ///
  /// In zh, this message translates to:
  /// **'暂无收藏文章'**
  String get savedEmpty;

  /// No description provided for @savedHint.
  ///
  /// In zh, this message translates to:
  /// **'收藏喜欢的文章，方便以后回看'**
  String get savedHint;

  /// No description provided for @savedCount.
  ///
  /// In zh, this message translates to:
  /// **'已收藏 {count} 篇'**
  String savedCount(int count);

  /// No description provided for @selectArticle.
  ///
  /// In zh, this message translates to:
  /// **'选择一篇文章开始阅读'**
  String get selectArticle;

  /// No description provided for @sharePreview.
  ///
  /// In zh, this message translates to:
  /// **'分享预览'**
  String get sharePreview;

  /// No description provided for @cardSummary.
  ///
  /// In zh, this message translates to:
  /// **'图文摘要'**
  String get cardSummary;

  /// No description provided for @cardSummaryHint.
  ///
  /// In zh, this message translates to:
  /// **'确认排版后分享图片，二维码指向文章原文。'**
  String get cardSummaryHint;

  /// No description provided for @updatePreview.
  ///
  /// In zh, this message translates to:
  /// **'更新预览'**
  String get updatePreview;

  /// No description provided for @shareThisImage.
  ///
  /// In zh, this message translates to:
  /// **'分享这张图片'**
  String get shareThisImage;

  /// No description provided for @contentModified.
  ///
  /// In zh, this message translates to:
  /// **'内容已修改，请先更新预览。'**
  String get contentModified;

  /// No description provided for @includeImage.
  ///
  /// In zh, this message translates to:
  /// **'包含配图'**
  String get includeImage;

  /// No description provided for @articleImage.
  ///
  /// In zh, this message translates to:
  /// **'文章配图'**
  String get articleImage;

  /// No description provided for @chooseImage.
  ///
  /// In zh, this message translates to:
  /// **'选择分享配图'**
  String get chooseImage;

  /// No description provided for @chooseImageHint.
  ///
  /// In zh, this message translates to:
  /// **'图片会等比完整显示。选择后点“使用此配图”，预览会自动更新。'**
  String get chooseImageHint;

  /// No description provided for @useThisImage.
  ///
  /// In zh, this message translates to:
  /// **'使用此配图'**
  String get useThisImage;

  /// No description provided for @textOnlyCard.
  ///
  /// In zh, this message translates to:
  /// **'纯文字卡片'**
  String get textOnlyCard;

  /// No description provided for @noImage.
  ///
  /// In zh, this message translates to:
  /// **'不包含文章图片'**
  String get noImage;

  /// No description provided for @imageUnavailable.
  ///
  /// In zh, this message translates to:
  /// **'这张图片暂时无法读取，预览已使用纯文字；可以换一张图片。'**
  String get imageUnavailable;

  /// No description provided for @shareExcerpt.
  ///
  /// In zh, this message translates to:
  /// **'分享摘要'**
  String get shareExcerpt;

  /// No description provided for @excerptHint.
  ///
  /// In zh, this message translates to:
  /// **'卡片最多展示六行，较长内容会省略。'**
  String get excerptHint;

  /// No description provided for @previewFailed.
  ///
  /// In zh, this message translates to:
  /// **'预览生成失败，请重试'**
  String get previewFailed;

  /// No description provided for @shareSaveFailed.
  ///
  /// In zh, this message translates to:
  /// **'无法保存图片或打开系统分享面板，请重试'**
  String get shareSaveFailed;

  /// No description provided for @cardPreviewLabel.
  ///
  /// In zh, this message translates to:
  /// **'即将分享的卡片预览'**
  String get cardPreviewLabel;

  /// No description provided for @shareCardContent.
  ///
  /// In zh, this message translates to:
  /// **'分享摘要'**
  String get shareCardContent;

  /// No description provided for @excerptHelper.
  ///
  /// In zh, this message translates to:
  /// **'卡片最多展示六行，较长内容会省略。'**
  String get excerptHelper;

  /// No description provided for @qrcodeHint.
  ///
  /// In zh, this message translates to:
  /// **'扫码阅读原文'**
  String get qrcodeHint;

  /// No description provided for @articleShare.
  ///
  /// In zh, this message translates to:
  /// **'文章分享'**
  String get articleShare;

  /// No description provided for @qrScanHint.
  ///
  /// In zh, this message translates to:
  /// **'扫码或点击阅读原文'**
  String get qrScanHint;

  /// No description provided for @brandFooter.
  ///
  /// In zh, this message translates to:
  /// **'Aurora · 本地优先 RSS 阅读器'**
  String get brandFooter;

  /// No description provided for @auroraBrand.
  ///
  /// In zh, this message translates to:
  /// **'Aurora'**
  String get auroraBrand;

  /// No description provided for @noFeedsForExport.
  ///
  /// In zh, this message translates to:
  /// **'当前没有可导出的订阅'**
  String get noFeedsForExport;

  /// No description provided for @opmlImportFailed.
  ///
  /// In zh, this message translates to:
  /// **'导入 OPML 失败：{error}'**
  String opmlImportFailed(String error);

  /// No description provided for @opmlExportFailed.
  ///
  /// In zh, this message translates to:
  /// **'导出失败：{error}'**
  String opmlExportFailed(String error);

  /// No description provided for @opmlNoValidFeeds.
  ///
  /// In zh, this message translates to:
  /// **'文件中没有有效订阅'**
  String get opmlNoValidFeeds;

  /// No description provided for @opmlImported.
  ///
  /// In zh, this message translates to:
  /// **'已导入 {count} 个订阅'**
  String opmlImported(int count);

  /// No description provided for @notificationNewArticles.
  ///
  /// In zh, this message translates to:
  /// **'{count} 篇新文章'**
  String notificationNewArticles(int count);

  /// No description provided for @subscriptionNotificationChannel.
  ///
  /// In zh, this message translates to:
  /// **'订阅源刷新后收到的新文章通知'**
  String get subscriptionNotificationChannel;

  /// No description provided for @deleteGroupTitle.
  ///
  /// In zh, this message translates to:
  /// **'解散分组（订阅移入未分组）'**
  String get deleteGroupTitle;

  /// No description provided for @renameGroup.
  ///
  /// In zh, this message translates to:
  /// **'重命名分组'**
  String get renameGroup;

  /// No description provided for @showGroupName.
  ///
  /// In zh, this message translates to:
  /// **'显示的分组'**
  String get showGroupName;

  /// No description provided for @noGroupsYet.
  ///
  /// In zh, this message translates to:
  /// **'暂无分组'**
  String get noGroupsYet;

  /// No description provided for @groupFeedCount.
  ///
  /// In zh, this message translates to:
  /// **'{count} 源'**
  String groupFeedCount(int count);

  /// No description provided for @groupUnread.
  ///
  /// In zh, this message translates to:
  /// **'{count} 未读'**
  String groupUnread(int count);

  /// No description provided for @groupFeedsAndUnread.
  ///
  /// In zh, this message translates to:
  /// **'{count} 源 · {unread} 未读'**
  String groupFeedsAndUnread(int count, int unread);

  /// No description provided for @moveGroupFailed.
  ///
  /// In zh, this message translates to:
  /// **'移动分组失败：{error}'**
  String moveGroupFailed(String error);

  /// No description provided for @renameGroupFailed.
  ///
  /// In zh, this message translates to:
  /// **'重命名分组失败：{error}'**
  String renameGroupFailed(String error);

  /// No description provided for @loadArticlesFailed.
  ///
  /// In zh, this message translates to:
  /// **'加载文章失败：{error}'**
  String loadArticlesFailed(String error);

  /// No description provided for @updateReadStateFailed.
  ///
  /// In zh, this message translates to:
  /// **'更新阅读状态失败：{error}'**
  String updateReadStateFailed(String error);

  /// No description provided for @updateStarredFailed.
  ///
  /// In zh, this message translates to:
  /// **'更新收藏状态失败：{error}'**
  String updateStarredFailed(String error);

  /// No description provided for @imageLoadFailed.
  ///
  /// In zh, this message translates to:
  /// **'图片加载失败'**
  String get imageLoadFailed;

  /// No description provided for @savedToGallery.
  ///
  /// In zh, this message translates to:
  /// **'已保存到相册'**
  String get savedToGallery;

  /// No description provided for @saveToGallery.
  ///
  /// In zh, this message translates to:
  /// **'保存到相册'**
  String get saveToGallery;

  /// No description provided for @saveFailed.
  ///
  /// In zh, this message translates to:
  /// **'保存失败'**
  String get saveFailed;

  /// No description provided for @extractFailedKeepContent.
  ///
  /// In zh, this message translates to:
  /// **'全文提取失败，继续显示订阅正文：{error}'**
  String extractFailedKeepContent(String error);

  /// No description provided for @openLinkFailed.
  ///
  /// In zh, this message translates to:
  /// **'无法打开链接'**
  String get openLinkFailed;

  /// No description provided for @bili.
  ///
  /// In zh, this message translates to:
  /// **'哔哩哔哩'**
  String get bili;

  /// No description provided for @video.
  ///
  /// In zh, this message translates to:
  /// **'视频'**
  String get video;

  /// No description provided for @videoCardHint.
  ///
  /// In zh, this message translates to:
  /// **'视频内容请点击下方卡片观看。'**
  String get videoCardHint;

  /// No description provided for @noBodyTryExtract.
  ///
  /// In zh, this message translates to:
  /// **'该订阅没有提供正文，请尝试提取全文或打开原文。'**
  String get noBodyTryExtract;

  /// No description provided for @translateTitleButton.
  ///
  /// In zh, this message translates to:
  /// **'翻译标题'**
  String get translateTitleButton;

  /// No description provided for @translatingTitleProgress.
  ///
  /// In zh, this message translates to:
  /// **'翻译标题中…'**
  String get translatingTitleProgress;

  /// No description provided for @unknownFeed.
  ///
  /// In zh, this message translates to:
  /// **'未知订阅'**
  String get unknownFeed;

  /// No description provided for @unknownError.
  ///
  /// In zh, this message translates to:
  /// **'未知错误'**
  String get unknownError;

  /// No description provided for @errorTimeout.
  ///
  /// In zh, this message translates to:
  /// **'站点响应超时，'**
  String get errorTimeout;

  /// No description provided for @errorAntiBot.
  ///
  /// In zh, this message translates to:
  /// **'该网站启用了反爬保护，'**
  String get errorAntiBot;

  /// No description provided for @error403.
  ///
  /// In zh, this message translates to:
  /// **'站点拒绝访问（403），'**
  String get error403;

  /// No description provided for @errorNetwork.
  ///
  /// In zh, this message translates to:
  /// **'网络连接失败，'**
  String get errorNetwork;

  /// No description provided for @errorHandshake.
  ///
  /// In zh, this message translates to:
  /// **'安全连接被中断（网络或代理不稳定）'**
  String get errorHandshake;

  /// No description provided for @errorParse.
  ///
  /// In zh, this message translates to:
  /// **'返回的不是有效的订阅格式'**
  String get errorParse;

  /// No description provided for @errorHttpStatus.
  ///
  /// In zh, this message translates to:
  /// **'HTTP {code} 错误'**
  String errorHttpStatus(String code);

  /// No description provided for @refreshOneFailed.
  ///
  /// In zh, this message translates to:
  /// **'刷新 {title} 失败：{reason}'**
  String refreshOneFailed(String title, String reason);

  /// No description provided for @refreshAllFailed.
  ///
  /// In zh, this message translates to:
  /// **'刷新订阅失败：{error}'**
  String refreshAllFailed(String error);

  /// No description provided for @addFailedPrefix.
  ///
  /// In zh, this message translates to:
  /// **'添加订阅失败：'**
  String get addFailedPrefix;

  /// No description provided for @addFailedNetworkReason.
  ///
  /// In zh, this message translates to:
  /// **'站点可能无法从当前网络访问'**
  String get addFailedNetworkReason;

  /// No description provided for @newArticlesNotification.
  ///
  /// In zh, this message translates to:
  /// **'{count} 篇新文章'**
  String newArticlesNotification(int count);

  /// No description provided for @subscriptionChannelName.
  ///
  /// In zh, this message translates to:
  /// **'订阅源刷新后收到的新文章通知'**
  String get subscriptionChannelName;

  /// No description provided for @deleteGroupMoveToDefault.
  ///
  /// In zh, this message translates to:
  /// **'解散分组（订阅移入未分组）'**
  String get deleteGroupMoveToDefault;

  /// No description provided for @renameGroupTitle.
  ///
  /// In zh, this message translates to:
  /// **'重命名分组'**
  String get renameGroupTitle;

  /// No description provided for @newGroupNameLabel.
  ///
  /// In zh, this message translates to:
  /// **'新分组名称'**
  String get newGroupNameLabel;

  /// No description provided for @showGroupNameLabel.
  ///
  /// In zh, this message translates to:
  /// **'显示的分组'**
  String get showGroupNameLabel;

  /// No description provided for @noGroupsLabel.
  ///
  /// In zh, this message translates to:
  /// **'暂无分组'**
  String get noGroupsLabel;

  /// No description provided for @sourcesCount.
  ///
  /// In zh, this message translates to:
  /// **'{count} 个订阅'**
  String sourcesCount(int count);

  /// No description provided for @errorTimeoutMsg.
  ///
  /// In zh, this message translates to:
  /// **'站点响应超时，'**
  String get errorTimeoutMsg;

  /// No description provided for @errorAntiBotMsg.
  ///
  /// In zh, this message translates to:
  /// **'该网站启用了反爬保护，'**
  String get errorAntiBotMsg;

  /// No description provided for @error403Msg.
  ///
  /// In zh, this message translates to:
  /// **'站点拒绝访问（403），'**
  String get error403Msg;

  /// No description provided for @errorNetworkMsg.
  ///
  /// In zh, this message translates to:
  /// **'网络连接失败，'**
  String get errorNetworkMsg;

  /// No description provided for @errorHandshakeMsg.
  ///
  /// In zh, this message translates to:
  /// **'安全连接被中断（网络或代理不稳定）'**
  String get errorHandshakeMsg;

  /// No description provided for @errorParseMsg.
  ///
  /// In zh, this message translates to:
  /// **'返回的不是有效的订阅格式'**
  String get errorParseMsg;

  /// No description provided for @errorHttpStatusMsg.
  ///
  /// In zh, this message translates to:
  /// **'HTTP {code} 错误'**
  String errorHttpStatusMsg(String code);

  /// No description provided for @refreshOneFailedMsg.
  ///
  /// In zh, this message translates to:
  /// **'刷新 {title} 失败：{reason}'**
  String refreshOneFailedMsg(String title, String reason);

  /// No description provided for @refreshAllFailedMsg.
  ///
  /// In zh, this message translates to:
  /// **'刷新订阅失败：{error}'**
  String refreshAllFailedMsg(String error);
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'zh'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'zh':
      return AppLocalizationsZh();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
