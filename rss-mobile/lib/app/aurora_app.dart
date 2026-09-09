import 'package:flutter/material.dart';

import '../features/audio/podcast_overlay.dart';
import '../features/reader/mobile_reader_controller.dart';
import '../features/shell/aurora_shell.dart';

final class AuroraApp extends StatefulWidget {
  const AuroraApp({required this.controller, super.key});

  final MobileReaderController controller;

  @override
  State<AuroraApp> createState() => _AuroraAppState();
}

class _AuroraAppState extends State<AuroraApp> {
  final _navigatorKey = GlobalKey<NavigatorState>();
  final _podcastRoutes = PodcastRouteObserver();

  @override
  void dispose() {
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
      themeMode: ThemeMode.system,
      home: AuroraShell(controller: widget.controller),
    );
  }
}
