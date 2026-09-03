import 'dart:convert';
import 'dart:typed_data';

import 'package:aurora_mobile/domain/feed_parsing/feed_date.dart';
import 'package:aurora_mobile/domain/feed_parsing/feed_encoding.dart';
import 'package:aurora_mobile/domain/feed_parsing/feed_parser.dart';
import 'package:aurora_mobile/domain/feed_parsing/parsed_feed.dart';
import 'package:charset/charset.dart' as charset;
import 'package:enough_convert/enough_convert.dart' as enough;
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('detectFeedEncoding', () {
    test('defaults to UTF-8 without declaration', () {
      final result = detectFeedEncoding(utf8.encode('<rss/>'));
      expect(result.encoding, 'utf-8');
      expect(result.hasBom, isFalse);
    });

    test('detects UTF-8 BOM', () {
      final bytes = Uint8List.fromList([
        0xEF,
        0xBB,
        0xBF,
        ...utf8.encode('<rss/>'),
      ]);
      final result = detectFeedEncoding(bytes);
      expect(result.encoding, 'utf-8');
      expect(result.hasBom, isTrue);
      expect(decodeFeedBytes(bytes), '<rss/>');
    });

    test('reads encoding from XML declaration', () {
      const xml = '<?xml version="1.0" encoding="GBK"?><rss/>';
      final result = detectFeedEncoding(utf8.encode(xml));
      expect(result.encoding, 'gb18030');
      expect(result.hasBom, isFalse);
    });

    test('normalizes shift_jis spelling', () {
      const xml = '<?xml version="1.0" encoding="Shift_JIS"?><feed/>';
      expect(detectFeedEncoding(utf8.encode(xml)).encoding, 'shift-jis');
    });
  });

  group('decodeFeedBytes', () {
    test('decodes GBK Chinese content', () {
      const declaration = '<?xml version="1.0" encoding="GBK"?><rss>';
      final gbk = const charset.GbkCodec(allowMalformed: false);
      final gbkBody = gbk.encode(
        '<channel><title>中文订阅源</title></channel></rss>',
      );
      final bytes = Uint8List.fromList([
        ...utf8.encode(declaration),
        ...gbkBody,
      ]);

      final text = decodeFeedBytes(bytes);
      expect(text, contains('中文订阅源'));
    });

    test('decodes Big5 traditional Chinese content', () {
      const declaration = '<?xml version="1.0" encoding="Big5"?><rss>';
      const codec = enough.Big5Codec(allowInvalid: false);
      final bytes = Uint8List.fromList([
        ...utf8.encode(declaration),
        ...codec.encode('<channel><title>繁體訂閱</title></channel></rss>'),
      ]);

      expect(decodeFeedBytes(bytes), contains('繁體訂閱'));
    });

    test('decodes Shift-JIS Japanese content', () {
      const declaration = '<?xml version="1.0" encoding="Shift_JIS"?><rss>';
      const codec = charset.ShiftJISCodec(allowMalformed: false);
      final bytes = Uint8List.fromList([
        ...utf8.encode(declaration),
        ...codec.encode('<channel><title>日本語フィード</title></channel></rss>'),
      ]);

      expect(decodeFeedBytes(bytes), contains('日本語フィード'));
    });

    test('decodes UTF-16 little and big endian documents with BOM', () {
      const encoder = charset.Utf16Encoder();
      const xml =
          '<?xml version="1.0"?><rss><channel><title>UTF16</title></channel></rss>';

      final littleEndian = encoder.encodeUtf16Le(xml, true);
      final bigEndian = encoder.encodeUtf16Be(xml, true);

      expect(decodeFeedBytes(littleEndian), xml);
      expect(decodeFeedBytes(bigEndian), xml);
    });
  });

  group('parseFeedBytes RSS 2.0', () {
    test('parses a complete feed with namespaces', () {
      const xml = '''
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:media="http://search.yahoo.com/mrss/"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Aurora Dev Feed</title>
    <link>https://example.com</link>
    <description>Test channel</description>
    <lastBuildDate>Wed, 02 Sep 2026 08:00:00 GMT</lastBuildDate>
    <item>
      <title>First article</title>
      <link>https://example.com/1</link>
      <guid isPermaLink="false">aurora-1</guid>
      <pubDate>Wed, 02 Sep 2026 07:30:00 +0800</pubDate>
      <dc:creator>Alice</dc:creator>
      <category>Tech</category>
      <category>Flutter</category>
      <description>Short summary</description>
      <content:encoded><![CDATA[<p>Full body</p><img src="https://img.example.com/a.png">]]></content:encoded>
      <media:thumbnail url="https://img.example.com/thumb.jpg"/>
    </item>
  </channel>
</rss>
''';
      final feed = parseFeedBytes(
        Uint8List.fromList(utf8.encode(xml)),
        feedUrl: Uri.parse('https://example.com/feed.xml'),
      );

      expect(feed.format, FeedFormat.rss2);
      expect(feed.title, 'Aurora Dev Feed');
      expect(feed.link, Uri.parse('https://example.com'));
      expect(feed.updatedAt, DateTime.utc(2026, 9, 2, 8));

      final entry = feed.entries.single;
      expect(entry.guid, 'aurora-1');
      expect(entry.author, 'Alice');
      expect(entry.summaryHtml, 'Short summary');
      expect(entry.contentHtml, contains('Full body'));
      // +0800 timezone: 07:30 local == 23:30 previous day UTC
      expect(entry.publishedAt, DateTime.utc(2026, 9, 1, 23, 30));
      expect(entry.imageUrls, contains('https://img.example.com/thumb.jpg'));
      expect(entry.imageUrls, contains('https://img.example.com/a.png'));
      expect(entry.categories, ['Tech', 'Flutter']);
    });

    test('falls back to link when guid is missing', () {
      const xml = '''
<rss version="2.0"><channel><title>t</title>
<item><title>No guid</title><link>https://example.com/noguid</link></item>
</channel></rss>
''';
      final feed = parseFeedBytes(utf8.encode(xml));
      expect(feed.entries.single.guid, 'https://example.com/noguid');
    });

    test('falls back to title hash when guid and link are missing', () {
      const xml = '''
<rss version="2.0"><channel><title>t</title>
<item><title>Orphan item</title></item>
</channel></rss>
''';
      final feed = parseFeedBytes(utf8.encode(xml));
      expect(feed.entries.single.guid, startsWith('title-'));
    });

    test('parses duplicate guids without crashing', () {
      const xml = '''
<rss version="2.0"><channel><title>t</title>
<item><guid>dup</guid><title>First</title></item>
<item><guid>dup</guid><title>Second</title></item>
</channel></rss>
''';
      final feed = parseFeedBytes(utf8.encode(xml));
      expect(feed.entries, hasLength(2));
      // Dedup is the ingest layer's job; parser must only report both items.
    });

    test('parses unix timestamp pubDate', () {
      const xml = '''
<rss version="2.0"><channel><title>t</title>
<item><guid>u1</guid><pubDate>1788335400</pubDate></item>
</channel></rss>
''';
      final feed = parseFeedBytes(utf8.encode(xml));
      expect(
        feed.entries.single.publishedAt,
        DateTime.fromMillisecondsSinceEpoch(1788335400 * 1000, isUtc: true),
      );
    });

    test('detects podcast audio enclosure', () {
      const xml = '''
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel><title>Podcast</title>
<item>
  <guid>ep1</guid><title>Episode 1</title>
  <itunes:duration>24:10</itunes:duration>
  <enclosure url="https://cdn.example.com/ep1.mp3" type="audio/mpeg" length="3600000"/>
</item>
</channel></rss>
''';
      final entry = parseFeedBytes(utf8.encode(xml)).entries.single;
      final audio = entry.enclosure.single;
      expect(audio.isAudio, isTrue);
      expect(audio.type, 'audio/mpeg');
      expect(audio.lengthInBytes, 3600000);
      expect(entry.duration, const Duration(minutes: 24, seconds: 10));
    });

    test('extracts Media RSS image and video content', () {
      const xml = '''
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel><title>Media</title>
<item><guid>m1</guid><title>Media item</title>
  <media:content url="https://cdn.example.com/photo.webp" type="image/webp" medium="image"/>
  <media:content url="https://cdn.example.com/movie.mp4" type="video/mp4" medium="video"/>
</item>
</channel></rss>
''';
      final entry = parseFeedBytes(utf8.encode(xml)).entries.single;
      expect(entry.imageUrls, contains('https://cdn.example.com/photo.webp'));
      expect(entry.videoUrl, Uri.parse('https://cdn.example.com/movie.mp4'));
    });

    test('extracts DOI and PMID from namespaced identifiers', () {
      const xml = '''
<rss version="2.0"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:prism="http://prismstandard.org/namespaces/basic/2.0/">
<channel><title>Academic</title>
<item><guid>a1</guid><title>Paper</title>
  <prism:doi>doi:10.1234/AURORA.2026.1</prism:doi>
  <dc:identifier>PMID: 12345678</dc:identifier>
</item>
</channel></rss>
''';
      final entry = parseFeedBytes(utf8.encode(xml)).entries.single;
      expect(entry.doi, '10.1234/AURORA.2026.1');
      expect(entry.pmid, '12345678');
    });

    test('recognizes youtube links as video entries', () {
      const xml = '''
<rss version="2.0"><channel><title>t</title>
<item><guid>v1</guid><link>https://www.youtube.com/watch?v=abc123</link></item>
</channel></rss>
''';
      final entry = parseFeedBytes(utf8.encode(xml)).entries.single;
      expect(entry.videoUrl, isNotNull);
    });
  });

  group('parseFeedBytes Atom', () {
    test('parses entries with iso8601 dates and enclosure links', () {
      const xml = '''
<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Blog</title>
  <subtitle>Subtitle</subtitle>
  <link href="https://blog.example.com"/>
  <link rel="self" href="https://blog.example.com/atom.xml"/>
  <updated>2026-09-02T10:00:00Z</updated>
  <entry>
    <id>tag:blog.example.com,2026:1</id>
    <title>Atom post</title>
    <link rel="alternate" href="https://blog.example.com/posts/1"/>
    <link rel="enclosure" href="https://cdn.example.com/pic.jpg" type="image/jpeg" length="2048"/>
    <published>2026-09-01T12:00:00+08:00</published>
    <updated>2026-09-02T10:00:00Z</updated>
    <author><name>Bob</name></author>
    <category term="dart"/>
    <summary>Atom summary</summary>
    <content type="html">&lt;p&gt;Body&lt;/p&gt;</content>
  </entry>
</feed>
''';
      final feed = parseFeedBytes(utf8.encode(xml));

      expect(feed.format, FeedFormat.atom);
      expect(feed.title, 'Atom Blog');
      expect(feed.link, Uri.parse('https://blog.example.com'));

      final entry = feed.entries.single;
      expect(entry.guid, 'tag:blog.example.com,2026:1');
      expect(entry.author, 'Bob');
      expect(entry.publishedAt, DateTime.utc(2026, 9, 1, 4));
      expect(entry.categories, ['dart']);
      expect(entry.enclosure.single.isImage, isTrue);
    });
  });

  group('parseFeedBytes failures', () {
    test('rejects non-feed XML', () {
      expect(
        () => parseFeedBytes(utf8.encode('<html><body>hi</body></html>')),
        throwsA(isA<FeedParseException>()),
      );
    });

    test('rejects malformed XML', () {
      expect(
        () => parseFeedBytes(utf8.encode('<rss><channel>broken')),
        throwsA(isA<FeedParseException>()),
      );
    });
  });

  group('parseFeedDate', () {
    test('handles common RFC 822 shapes', () {
      expect(
        parseFeedDate('Wed, 02 Sep 2026 08:00:00 GMT'),
        DateTime.utc(2026, 9, 2, 8),
      );
      expect(
        parseFeedDate('2 Sep 26 08:00:00 +0000'),
        DateTime.utc(2026, 9, 2, 8),
      );
      expect(parseFeedDate('2026-09-02T08:00:00'), DateTime.utc(2026, 9, 2, 8));
      expect(parseFeedDate('garbage'), isNull);
      expect(parseFeedDate(null), isNull);
    });
  });
}
