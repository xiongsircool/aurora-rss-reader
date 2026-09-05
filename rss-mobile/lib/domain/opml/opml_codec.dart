import 'dart:typed_data';

import 'package:xml/xml.dart';

import '../entities/feed.dart';
import '../feed_parsing/feed_encoding.dart';

final class OpmlException implements Exception {
  const OpmlException(this.message);

  final String message;

  @override
  String toString() => 'OpmlException: $message';
}

final class ImportedFeed {
  const ImportedFeed({
    required this.title,
    required this.url,
    required this.groupName,
  });

  final String title;
  final Uri url;
  final String groupName;
}

List<ImportedFeed> parseOpml(Uint8List bytes) {
  try {
    final document = XmlDocument.parse(decodeFeedBytes(bytes));
    if (document.rootElement.name.local.toLowerCase() != 'opml') {
      throw const OpmlException('根元素不是 OPML');
    }
    final body = document.rootElement.getElement('body');
    if (body == null) throw const OpmlException('缺少 OPML body');

    final byUrl = <String, ImportedFeed>{};
    for (final outline in body.findElements('outline')) {
      _collectOutlines(outline, null, byUrl);
    }
    return byUrl.values.toList();
  } on XmlException catch (error) {
    throw OpmlException('XML 格式错误：${error.message}');
  }
}

String buildOpml(Iterable<Feed> feeds) {
  final grouped = <String, List<Feed>>{};
  for (final feed in feeds) {
    grouped.putIfAbsent(feed.groupName, () => []).add(feed);
  }
  for (final values in grouped.values) {
    values.sort((a, b) => a.title.compareTo(b.title));
  }

  final builder = XmlBuilder();
  builder.processing('xml', 'version="1.0" encoding="UTF-8"');
  builder.element(
    'opml',
    attributes: {'version': '2.0'},
    nest: () {
      builder.element(
        'head',
        nest: () {
          builder.element('title', nest: 'Aurora RSS Reader subscriptions');
          builder.element(
            'dateCreated',
            nest: DateTime.now().toUtc().toIso8601String(),
          );
        },
      );
      builder.element(
        'body',
        nest: () {
          final groupNames = grouped.keys.toList()..sort();
          for (final groupName in groupNames) {
            final values = grouped[groupName]!;
            if (groupName == 'default') {
              for (final feed in values) {
                _writeFeedOutline(builder, feed);
              }
            } else {
              builder.element(
                'outline',
                attributes: {'text': groupName, 'title': groupName},
                nest: () {
                  for (final feed in values) {
                    _writeFeedOutline(builder, feed);
                  }
                },
              );
            }
          }
        },
      );
    },
  );
  return builder.buildDocument().toXmlString(pretty: true, indent: '  ');
}

void _collectOutlines(
  XmlElement outline,
  String? inheritedGroup,
  Map<String, ImportedFeed> output,
) {
  final xmlUrl =
      outline.getAttribute('xmlUrl') ?? outline.getAttribute('xmlurl');
  if (xmlUrl != null) {
    final uri = Uri.tryParse(xmlUrl.trim());
    if (uri != null &&
        (uri.scheme == 'http' || uri.scheme == 'https') &&
        uri.host.isNotEmpty) {
      final title =
          outline.getAttribute('title') ??
          outline.getAttribute('text') ??
          uri.host;
      output[uri.toString()] = ImportedFeed(
        title: title.trim().isEmpty ? uri.host : title.trim(),
        url: uri,
        groupName: inheritedGroup ?? 'default',
      );
    }
    return;
  }

  final ownGroup =
      outline.getAttribute('title') ?? outline.getAttribute('text');
  final nextGroup = ownGroup == null || ownGroup.trim().isEmpty
      ? inheritedGroup
      : ownGroup.trim();
  for (final child in outline.findElements('outline')) {
    _collectOutlines(child, nextGroup, output);
  }
}

void _writeFeedOutline(XmlBuilder builder, Feed feed) {
  builder.element(
    'outline',
    attributes: {
      'type': 'rss',
      'text': feed.title,
      'title': feed.title,
      'xmlUrl': feed.url.toString(),
    },
  );
}
