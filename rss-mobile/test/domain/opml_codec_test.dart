import 'dart:convert';
import 'dart:typed_data';

import 'package:aurora_mobile/domain/entities/feed.dart';
import 'package:aurora_mobile/domain/opml/opml_codec.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses nested groups and deduplicates repeated URLs', () {
    const opml = '''
<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0"><body>
  <outline text="技术">
    <outline type="rss" text="Flutter" xmlUrl="https://example.com/flutter.xml"/>
    <outline type="rss" title="Dart" xmlUrl="https://example.com/dart.xml"/>
  </outline>
  <outline text="Duplicate" xmlUrl="https://example.com/flutter.xml"/>
</body></opml>
''';
    final feeds = parseOpml(Uint8List.fromList(utf8.encode(opml)));

    expect(feeds, hasLength(2));
    expect(
      feeds.singleWhere((feed) => feed.title == 'Duplicate').groupName,
      'default',
    );
    expect(feeds.singleWhere((feed) => feed.title == 'Dart').groupName, '技术');
  });

  test('exports and imports groups and escaped titles', () {
    final feeds = [
      Feed(
        id: 'one',
        title: 'News & Research',
        url: Uri.parse('https://example.com/news.xml'),
        groupName: 'Reading <Daily>',
      ),
      Feed(
        id: 'two',
        title: 'Default',
        url: Uri.parse('https://example.com/default.xml'),
      ),
    ];

    final exported = buildOpml(feeds);
    final imported = parseOpml(Uint8List.fromList(utf8.encode(exported)));

    expect(exported, contains('News &amp; Research'));
    expect(exported, contains('Reading &lt;Daily>'));
    expect(imported, hasLength(2));
    expect(
      imported.singleWhere((feed) => feed.title == 'News & Research').groupName,
      'Reading <Daily>',
    );
  });

  test('rejects malformed and non-OPML XML', () {
    expect(
      () => parseOpml(Uint8List.fromList(utf8.encode('<rss/>'))),
      throwsA(isA<OpmlException>()),
    );
    expect(
      () => parseOpml(Uint8List.fromList(utf8.encode('<opml><body>'))),
      throwsA(anything),
    );
  });
}
