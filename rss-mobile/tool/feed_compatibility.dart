import 'dart:async';
import 'dart:io';

import 'package:aurora_mobile/domain/feed_parsing/feed_parser.dart';
import 'package:aurora_mobile/domain/feed_parsing/parsed_feed.dart';
import 'package:aurora_mobile/platform/http/io_feed_http_client.dart';

final class FeedProbe {
  const FeedProbe(this.name, this.url, this.kind);

  final String name;
  final String url;
  final String kind;
}

const probes = <FeedProbe>[
  FeedProbe('Hacker News', 'https://news.ycombinator.com/rss', 'RSS 2.0'),
  FeedProbe(
    'Flutter releases',
    'https://github.com/flutter/flutter/releases.atom',
    'Atom',
  ),
  FeedProbe('Stack Overflow', 'https://stackoverflow.com/feeds', 'Atom'),
  FeedProbe('xkcd', 'https://xkcd.com/atom.xml', 'Atom'),
  FeedProbe('Daring Fireball', 'https://daringfireball.net/feeds/main', 'Atom'),
  FeedProbe('GitHub Blog', 'https://github.blog/feed/', 'RSS 2.0'),
  FeedProbe(
    'BBC World',
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'RSS 2.0',
  ),
  FeedProbe(
    'NASA',
    'https://www.nasa.gov/rss/dyn/breaking_news.rss',
    'RSS 2.0',
  ),
  FeedProbe(
    'NYTimes Technology',
    'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
    'RSS 2.0',
  ),
  FeedProbe(
    'The Guardian World',
    'https://www.theguardian.com/world/rss',
    'RSS 2.0',
  ),
  FeedProbe(
    'Ars Technica',
    'https://feeds.arstechnica.com/arstechnica/index',
    'RSS 2.0',
  ),
  FeedProbe('Mozilla Hacks', 'https://hacks.mozilla.org/feed/', 'RSS 2.0'),
  FeedProbe(
    'Smashing Magazine',
    'https://www.smashingmagazine.com/feed/',
    'RSS 2.0',
  ),
  FeedProbe('9to5Mac', 'https://9to5mac.com/feed/', 'RSS 2.0'),
  FeedProbe('Cloudflare Blog', 'https://blog.cloudflare.com/rss/', 'RSS 2.0'),
  FeedProbe(
    'Apple Developer News',
    'https://developer.apple.com/news/rss/news.rss',
    'RSS 2.0',
  ),
  FeedProbe(
    'Android Developers',
    'https://android-developers.googleblog.com/feeds/posts/default',
    'Atom',
  ),
  FeedProbe(
    'NPR Up First',
    'https://feeds.npr.org/510318/podcast.xml',
    'Podcast',
  ),
  FeedProbe('Syntax', 'https://feed.syntax.fm/rss', 'Podcast'),
  FeedProbe(
    'Flutter YouTube',
    'https://www.youtube.com/feeds/videos.xml?channel_id=UCwXdFgeE9KYzlDdR7TG9cMw',
    'Media/Atom',
  ),
  FeedProbe('Nature', 'https://www.nature.com/nature.rss', 'Academic'),
  FeedProbe(
    'arXiv Computer Science',
    'https://export.arxiv.org/rss/cs',
    'Academic',
  ),
  FeedProbe('少数派', 'https://sspai.com/feed', 'Chinese'),
  FeedProbe('阮一峰', 'https://www.ruanyifeng.com/blog/atom.xml', 'Chinese/Atom'),
  FeedProbe('V2EX', 'https://www.v2ex.com/index.xml', 'Chinese'),
  FeedProbe('NHK News', 'https://www3.nhk.or.jp/rss/news/cat0.xml', 'Japanese'),
];

final class ProbeResult {
  const ProbeResult({
    required this.probe,
    required this.elapsed,
    this.feed,
    this.bytes,
    this.error,
  });

  final FeedProbe probe;
  final Duration elapsed;
  final ParsedFeed? feed;
  final int? bytes;
  final Object? error;

  bool get passed => feed != null && feed!.entries.isNotEmpty;
}

Future<void> main() async {
  final client = IoFeedHttpClient();
  try {
    final results = await _runWithConcurrency(
      probes,
      4,
      (probe) => _probe(client, probe),
    );
    _printReport(results);

    final passed = results.where((result) => result.passed).length;
    if (passed < 20) {
      stderr.writeln(
        'Only $passed/${results.length} probes passed; M0 requires at least 20.',
      );
      exitCode = 1;
    }
  } finally {
    client.close();
  }
}

Future<ProbeResult> _probe(IoFeedHttpClient client, FeedProbe probe) async {
  final watch = Stopwatch()..start();
  try {
    final response = await client.get(
      Uri.parse(probe.url),
      timeout: const Duration(seconds: 25),
      maxBytes: 15 * 1024 * 1024,
    );
    final feed = parseFeedBytes(response.body, feedUrl: response.finalUri);
    watch.stop();
    return ProbeResult(
      probe: probe,
      elapsed: watch.elapsed,
      feed: feed,
      bytes: response.body.length,
    );
  } catch (error) {
    watch.stop();
    return ProbeResult(probe: probe, elapsed: watch.elapsed, error: error);
  }
}

Future<List<R>> _runWithConcurrency<T, R>(
  List<T> items,
  int concurrency,
  Future<R> Function(T item) task,
) async {
  final results = List<R?>.filled(items.length, null);
  var next = 0;

  Future<void> worker() async {
    while (true) {
      final index = next++;
      if (index >= items.length) return;
      results[index] = await task(items[index]);
    }
  }

  await Future.wait(List.generate(concurrency, (_) => worker()));
  return results.cast<R>();
}

void _printReport(List<ProbeResult> results) {
  final now = DateTime.now().toUtc().toIso8601String();
  final passed = results.where((result) => result.passed).length;

  stdout.writeln('# Mobile M0 Real Feed Compatibility Report');
  stdout.writeln();
  stdout.writeln('- Generated: $now');
  stdout.writeln('- Passed: $passed/${results.length}');
  stdout.writeln('- Concurrency: 4');
  stdout.writeln('- Timeout: 25 seconds per feed');
  stdout.writeln('- Body limit: 15 MiB after decompression');
  stdout.writeln();
  stdout.writeln(
    '| Source | Kind | Result | Format | Entries | Bytes | Time | Details |',
  );
  stdout.writeln('|---|---|---:|---|---:|---:|---:|---|');

  for (final result in results) {
    final feed = result.feed;
    final error =
        result.error?.toString().replaceAll('|', r'\|').replaceAll('\n', ' ') ??
        '';
    stdout.writeln(
      '| ${result.probe.name} '
      '| ${result.probe.kind} '
      '| ${result.passed ? 'PASS' : 'FAIL'} '
      '| ${feed?.format.name ?? '-'} '
      '| ${feed?.entries.length ?? 0} '
      '| ${result.bytes ?? 0} '
      '| ${result.elapsed.inMilliseconds}ms '
      '| ${result.passed ? _details(feed!) : error} |',
    );
  }
}

String _details(ParsedFeed feed) {
  final images = feed.entries
      .where((entry) => entry.imageUrls.isNotEmpty)
      .length;
  final enclosures = feed.entries
      .where((entry) => entry.enclosure.isNotEmpty)
      .length;
  final dated = feed.entries.where((entry) => entry.publishedAt != null).length;
  return 'images=$images, enclosures=$enclosures, dated=$dated';
}
