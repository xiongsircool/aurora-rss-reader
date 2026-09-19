import 'dart:async';

import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:home_widget/home_widget.dart';

import '../l10n/generated/app_localizations.dart';

import '../domain/entities/entry.dart';
import '../features/audio/podcast_overlay.dart';
import '../features/reader/article_reader_page.dart';
import '../features/reader/mobile_reader_controller.dart';
import '../features/shell/aurora_shell.dart';
import '../platform/widget/aurora_widget.dart';

final class AuroraApp extends StatefulWidget {
  const AuroraApp({required this.controller, super.key});

  final MobileReaderController controller;

  @override
  State<AuroraApp> createState() => _AuroraAppState();
}

class _AuroraAppState extends State<AuroraApp> with WidgetsBindingObserver {
  final _navigatorKey = GlobalKey<NavigatorState>();
  final _podcastRoutes = PodcastRouteObserver();
  StreamSubscription<Uri?>? _widgetClickSub;
  Timer? _initialWidgetUpdateTimer;
  bool _deepLinkHandled = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    // Home screen widget deep links (mobile platforms only — also keeps
    // widget tests on desktop hosts free of MissingPluginException noise).
    if (Platform.isIOS || Platform.isAndroid) {
      _widgetClickSub = HomeWidget.widgetClicked.listen(
        _handleWidgetUri,
        onError: (Object _) {},
      );
      HomeWidget.initiallyLaunchedFromHomeWidget().then((uri) {
        if (uri != null) _handleWidgetUri(uri);
      }).catchError((Object _) {});
    }

    // Push an initial snapshot once entries are (very likely) loaded.
    if (Platform.isIOS || Platform.isAndroid) {
      _initialWidgetUpdateTimer = Timer(const Duration(seconds: 4), () {
        updateAuroraWidget(widget.controller.repository);
      });
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Refresh the widget whenever the app leaves the foreground so the
    // home screen always reflects the latest reading state.
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      updateAuroraWidget(widget.controller.repository);
    }
  }

  /// Handles `aurora://article/<id>` (and ignores other widget URIs for now).
  void _handleWidgetUri(Uri? uri) {
    if (uri == null || uri.scheme != 'aurora') return;
    if (uri.host != 'article') return; // stats/home just open the app (v1).
    final id = uri.pathSegments.isEmpty ? '' : uri.pathSegments.last;
    if (id.isEmpty) return;
    _openArticleFromWidget(id);
  }

  Future<void> _openArticleFromWidget(String id) async {
    if (_deepLinkHandled) return;
    Entry? entry;
    for (final e in widget.controller.entries) {
      if (e.id == id) {
        entry = e;
        break;
      }
    }
    if (entry == null) {
      // Cold start may race with the inbox load — fall back to a direct
      // database lookup instead of waiting for the list.
      try {
        entry = await widget.controller.repository.entryById(id);
      } catch (_) {}
    }
    if (entry == null || !mounted) return; // Fall back to the home screen.

    String feedTitle = '';
    try {
      final feeds = await widget.controller.repository.listFeeds();
      for (final f in feeds) {
        if (f.id == entry.feedId) {
          feedTitle = f.title;
          break;
        }
      }
    } catch (_) {}

    _deepLinkHandled = true;
    _navigatorKey.currentState?.push(
      MaterialPageRoute<void>(
        builder: (_) => ArticleReaderPage(
          entry: entry!,
          feedTitle: feedTitle,
          controller: widget.controller,
        ),
      ),
    );
    Future<void>.delayed(const Duration(seconds: 1))
        .then((_) => _deepLinkHandled = false);
  }

  @override
  void dispose() {
    _initialWidgetUpdateTimer?.cancel();
    final sub = _widgetClickSub;
    if (sub != null) {
      unawaited(sub.cancel().catchError((Object _) {}));
    }
    WidgetsBinding.instance.removeObserver(this);
    _podcastRoutes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const lightScheme = ColorScheme(
      brightness: Brightness.light,
      primary: Color(0xFFE85D24),
      onPrimary: Colors.white,
      secondary: Color(0xFF087E8B),
      onSecondary: Colors.white,
      error: Color(0xFFBA1A1A),
      onError: Colors.white,
      surface: Color(0xFFF8F9FA),
      onSurface: Color(0xFF202124),
    );
    const darkScheme = ColorScheme(
      brightness: Brightness.dark,
      primary: Color(0xFFFFB68A),
      onPrimary: Color(0xFF3A1D00),
      secondary: Color(0xFF6FD6E3),
      onSecondary: Color(0xFF00363B),
      error: Color(0xFFFFB4AB),
      onError: Color(0xFF690005),
      surface: Color(0xFF14161A),
      onSurface: Color(0xFFE4E2E6),
    );

    return MaterialApp(
      navigatorKey: _navigatorKey,
      navigatorObservers: [_podcastRoutes],
      builder: (context, child) => PodcastOverlayHost(
        controller: widget.controller.podcast,
        observer: _podcastRoutes,
        navigatorKey: _navigatorKey,
        child: child!,
      ),
      title: 'Aurora RSS Reader',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: lightScheme,
        scaffoldBackgroundColor: lightScheme.surface,
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFFF8F9FA),
          foregroundColor: Color(0xFF202124),
          elevation: 0,
          centerTitle: false,
          titleTextStyle: TextStyle(
            color: Color(0xFF202124),
            fontSize: 20,
            fontWeight: FontWeight.w700,
          ),
        ),
        navigationBarTheme: const NavigationBarThemeData(
          height: 68,
          indicatorColor: Color(0xFFFFDCCB),
          backgroundColor: Colors.white,
          labelTextStyle: WidgetStatePropertyAll(
            TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          ),
        ),
      ),
      darkTheme: ThemeData(
        colorScheme: darkScheme,
        scaffoldBackgroundColor: darkScheme.surface,
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF14161A),
          foregroundColor: Color(0xFFE4E2E6),
          elevation: 0,
          centerTitle: false,
          titleTextStyle: TextStyle(
            color: Color(0xFFE4E2E6),
            fontSize: 20,
            fontWeight: FontWeight.w700,
          ),
        ),
        navigationBarTheme: const NavigationBarThemeData(
          height: 68,
          indicatorColor: Color(0xFF52432F),
          backgroundColor: Color(0xFF1B1E23),
          labelTextStyle: WidgetStatePropertyAll(
            TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          ),
        ),
      ),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      themeMode: ThemeMode.system,
      home: AuroraShell(controller: widget.controller),
    );
  }
}
