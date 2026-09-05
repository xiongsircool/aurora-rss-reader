import 'package:flutter/material.dart';

import '../features/reader/mobile_reader_controller.dart';
import '../features/shell/aurora_shell.dart';

final class AuroraApp extends StatelessWidget {
  const AuroraApp({required this.controller, super.key});

  final MobileReaderController controller;

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
      home: AuroraShell(controller: controller),
    );
  }
}
