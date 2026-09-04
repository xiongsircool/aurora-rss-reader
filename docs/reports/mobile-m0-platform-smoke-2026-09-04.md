# Mobile M0 Platform Smoke Report - 2026-09-04

## Toolchains

- macOS 26.6.2
- Xcode 26.6 (Build 17F113)
- iPhoneOS SDK 26.5
- iOS Simulator Runtime 26.5 (23F77)
- CocoaPods 1.17.0
- Android SDK 36 / Build Tools 36.0.0
- Android Emulator 37.1.11
- JDK 17.0.20.1
- Flutter 3.47.2 / Dart 3.13.2

`flutter doctor -v` reports both Android and Xcode toolchains as passing. The independent network-resources check can still time out against Maven through the local network, but Android and iOS builds completed.

## iOS

```text
flutter build ios --simulator --debug
PASS - build/ios/iphonesimulator/Runner.app
```

- Device: iPhone 17 Pro simulator, iOS 26.5
- Application installed and launched with bundle ID `com.xiongsircool.aurora.mobile`
- Screenshot: 1206 x 2622, non-empty and correctly framed
- Inbox header, segmented filter, empty state, primary action and four bottom tabs fit within the viewport
- No Runner fatal/crash messages found in the simulator log
- Device-level integration tests: 2/2 passed
  - Four-tab navigation plus subscription form and parsed article display
  - `path_provider` + sqlite3 Native Assets file database write/query/delete
- Real-network HTTPS RSS fetch, device-side parse and SQLite persistence passed through the explicit development proxy

A generic physical-device Xcode compilation reached the provisioning stage, then correctly stopped because no Apple Development Team/Profile is configured. Physical deployment remains an explicit M0 gate.

## Android

- Device: Android 36 ARM64 emulator
- Debug APK assembled and installed
- Release APK built successfully (65.7 MB) and verified to contain `android.permission.INTERNET`
- Device-level integration tests: 2/2 passed
  - Four-tab navigation plus subscription form and parsed article display
  - `path_provider` + sqlite3 Native Assets file database write/query/delete
- Real-network HTTPS RSS fetch, device-side parse and SQLite persistence passed through the explicit development proxy

## Shared Data and Plugin Checks

- Drift schema v1/v2 to v3 migrations validated from exported real snapshots
- Schema v3 caches Readability HTML and rebuilds FTS5 to index extracted full text
- Persistent proxy setting survives database reads and applies without restart
- `url_launcher`, `file_picker` and `share_plus` native plugins compile on Android and iOS
- OPML UTI declared for the iOS document picker
- Mozilla Readability HTML extraction, CJK page decoding, failure fallback and schema-v3 cache validated
- Deterministic Flutter tests: 57 passing

## Physical Device (Android)

- Device: Xiaomi 14 Pro (23116PN5BC), HyperOS 3 / Android 16, arm64-v8a
- Debug APK installed and launched via adb
- Discovered and fixed: Flutter Impeller never rendered a frame on this device (0 frames); disabled Impeller via `io.flutter.embedding.android.EnableImpeller=false`, rendering restored with Skia
- Discovered and fixed: reader_mode default JSDOM parser failed on real-world sspai.com markup; switched primary parser to the pure-Dart html package
- End-to-end on-device validation via UI automation:
  - Added https://sspai.com/feed through the subscription form
  - Feed fetched, parsed, 10 articles persisted and rendered in the inbox
  - Article reader rendered feed content and auto-marked read
  - Web full-text extraction succeeded: page fetched, parsed, cached, and rendered with headings/lists/links
  - Extraction failure fallback was observed and correct before the parser fix
- No Flutter fatal errors in device logs

> Note: `flutter` CLI marks this device unsupported because HyperOS reports non-standard `ro.build.version.release/sdk` values; adb install and Flutter-rendered builds work normally.

## Remaining Platform Gates

- Android physical device refresh/performance run
- iOS physical device signing, install and refresh run
- Background execution behavior on each physical platform
