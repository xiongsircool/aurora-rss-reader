# Mobile M0 SQLite Benchmark - 2026-09-03

## Environment

- Host: MacBook Pro 18,1, Apple M1 Pro, 32 GB RAM
- macOS: 26.1
- Flutter: 3.47.2
- Dart: 3.13.2
- Drift: 2.34.4
- sqlite3: 3.5.2 (Native Assets)
- Database: in-memory SQLite with foreign keys, FTS5 triggers and production indexes

Command:

```bash
cd rss-mobile
flutter test test/performance/sqlite_benchmark_test.dart --reporter expanded
```

## Results

```text
open_ms=433
seed_50k_ms=1102
first_page_ms=9.161
pages_2_to_100_ms=451
fts_search_ms=1.225
insert_200_ms=27
```

Interpretation:

- Database initialization plus first Feed write remained below the initial 500 ms target.
- Cursor pagination remained far below the 100 ms target at both the first page and pages 2-100.
- Inserting 200 normalized entries remained far below the 500 ms target.
- FTS5 exact phrase lookup over 50,000 entries completed in about 1.2 ms.
- The 50,000-entry seed includes FTS trigger updates, so the write result reflects index maintenance.

## Caveats

These numbers establish a reproducible host baseline, not a device guarantee. M0 still requires the same benchmark on a selected low/mid-range Android physical device. iOS benchmarking remains blocked until full Xcode is installed.
