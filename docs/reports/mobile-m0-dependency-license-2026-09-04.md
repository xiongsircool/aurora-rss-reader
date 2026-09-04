# Mobile M0 Dependency License Review - 2026-09-04

Aurora RSS Reader is distributed under GPLv3. Direct mobile dependencies were checked from the license files installed in the Dart pub cache.

| Dependency | License | GPLv3 assessment |
|---|---|---|
| Flutter SDK / Cupertino Icons | BSD-3-Clause | Compatible |
| xml | MIT | Compatible |
| charset | Apache-2.0 | Compatible with GPLv3 |
| enough_convert | MPL-2.0 | Compatible through MPL 2.0 secondary-license provisions; modifications to MPL-covered files remain MPL |
| drift | MIT | Compatible |
| sqlite3 Dart wrapper | MIT | Compatible |
| SQLite engine | Public domain | Compatible |
| path / path_provider | BSD-3-Clause | Compatible |
| flutter_widget_from_html_core | MIT | Compatible |
| html | BSD-style | Compatible |
| url_launcher | BSD-3-Clause | Compatible |
| file_picker | MIT | Compatible |
| share_plus | BSD-3-Clause | Compatible |

Development-only dependencies (`flutter_test`, `integration_test`, `drift_dev`, `build_runner`, `flutter_lints`) are tooling and are not distributed as linked runtime libraries. Their generated output does not impose a conflicting runtime license.

No direct dependency reviewed here conflicts with distributing the application under GPLv3. Release packaging must retain dependency notices where required, especially Apache-2.0, MPL-2.0 and BSD notices.
