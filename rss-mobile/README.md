# Aurora RSS Reader Mobile

Flutter client for Aurora RSS Reader. Android and iOS are the initial targets; the app is local-first and must remain usable without a desktop backend or hosted account.

## Current Status

M0 technical validation is in progress. The repository currently contains:

- Android/iOS Flutter scaffold with application ID `com.xiongsircool.aurora.mobile`
- Four-tab mobile shell: Inbox, Saved, Sources, Settings
- Framework-independent Feed and Entry domain models
- Native `dart:io` HTTP adapter that preserves response bytes
- Explicit gzip/deflate decoding with compressed and decompressed size limits
- RSS 2.0, Atom, Media RSS and podcast parsing
- UTF-8/UTF-16, GBK, Big5 and Shift-JIS decoding (full four-byte GB18030 remains an M0 gap)
- Drift/sqlite3 Native Assets schema for feeds, entries, AI caches, tags and collections
- Feed + guid deduplication, cursor pagination, FTS5 search and cascade cleanup
- End-to-end local refresh pipeline: fetch bytes, decode, parse and persist only after validation
- Failed HTTP/XML refreshes preserve the previous local snapshot
- Tests for navigation, parsing, encodings, HTTP behavior and database contracts
- Reproducible 50,000-entry SQLite benchmark

The previous Vue/Capacitor client is preserved on branch `archive/mobile-plan-d-v1` and is not part of this implementation.

## Requirements

- Flutter 3.47.2 / Dart 3.13.2
- Android SDK 36 + Build Tools 36.0.0 + JDK 17
- Full Xcode + CocoaPods for iOS builds

Check the local toolchain:

```bash
flutter doctor -v
```

## Verification

```bash
cd rss-mobile
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
flutter build apk --debug
flutter build ios --debug --no-codesign
```

The iOS command remains blocked until full Xcode is installed.

## Architecture

```text
lib/
├── app/          # App composition and theme
├── domain/       # Entities and policies; no Flutter UI or storage imports
├── application/  # Use cases and repository/platform ports
├── data/         # SQLite implementations and migrations
├── platform/     # Android/iOS network, tasks, and secure storage adapters
├── features/     # User-facing screens grouped by workflow
└── shared/       # Reusable UI and utilities
```

See:

- `docs/adr/0001-mobile-local-first-flutter.md`
- `docs/plans/mobile-flutter-m0-plan.md`

## Product Modes

- **Local mode (default):** device fetches and parses feeds, stores SQLite data, and calls user-configured AI endpoints directly.
- **Self-hosted mode (later):** optional adapter for `/api/mobile`; it must not be required for startup or local reading.
- **Official cloud:** not planned for the initial mobile release.
