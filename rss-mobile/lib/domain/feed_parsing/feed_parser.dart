import 'dart:typed_data';

import 'package:xml/xml.dart';

import 'feed_date.dart';
import 'feed_encoding.dart';
import 'parsed_feed.dart';

final class FeedParseException implements Exception {
  const FeedParseException(this.message);

  final String message;

  @override
  String toString() => 'FeedParseException: $message';
}

/// Parses raw feed bytes into normalized [ParsedFeed] models.
///
/// Format detection is based on the root element local name; namespace
/// prefixes are matched loosely because real-world feeds mix `media:`,
/// `itunes:`, `dc:`, and `content:` with unpredictable prefixes.
ParsedFeed parseFeedBytes(Uint8List bytes, {Uri? feedUrl}) {
  final xmlText = decodeFeedBytes(bytes);
  final document = _parseXml(xmlText);
  final root = document.rootElement;

  switch (root.name.local.toLowerCase()) {
    case 'rss':
      return _parseRss(root, feedUrl, format: FeedFormat.rss2);
    case 'rdf':
      return _parseRss(root, feedUrl, format: FeedFormat.rss1);
    case 'feed':
      return _parseAtom(root, feedUrl);
    default:
      throw FeedParseException(
        'Unsupported feed root element <${root.name.local}>',
      );
  }
}

XmlDocument _parseXml(String text) {
  try {
    return XmlDocument.parse(text);
  } on XmlException catch (error) {
    throw FeedParseException('Malformed XML: ${error.message}');
  }
}

// ---------------------------------------------------------------------------
// RSS 2.0 / RDF
// ---------------------------------------------------------------------------

ParsedFeed _parseRss(
  XmlElement root,
  Uri? feedUrl, {
  required FeedFormat format,
}) {
  // RSS 2.0 nests items under <channel>; RSS 1.0 (RDF) puts items next
  // to <channel> at the root level.
  final channel = root.getElement('channel');
  final channelLike = channel ?? root;
  final itemParent = format == FeedFormat.rss1 ? root : channelLike;

  final title =
      _textOf(channelLike, 'title') ?? _fallbackTitle(feedUrl, channelLike);

  return ParsedFeed(
    title: title,
    link: _uriOf(_textOf(channelLike, 'link')),
    format: format,
    description: _textOf(channelLike, 'description'),
    updatedAt: parseFeedDate(
      _textOf(channelLike, 'lastBuildDate') ??
          _textOf(channelLike, 'pubDate') ??
          _namespaced(channelLike, 'date'),
    ),
    entries: itemParent
        .findElements('item')
        .map((item) => _parseRssItem(item, feedUrl))
        .toList(),
  );
}

ParsedEntry _parseRssItem(XmlElement item, Uri? feedUrl) {
  final link = _uriOf(_textOf(item, 'link')) ?? _guidLink(item);
  final author =
      _textOf(item, 'author') ??
      _namespaced(item, 'creator') ??
      _namespaced(item, 'author');

  final mediaImages = <String>[];
  _collectMediaImages(item, mediaImages);
  final enclosure = _parseEnclosures(item);

  final contentHtml =
      _namespaced(item, 'encoded') ?? _textOf(item, 'description');

  return ParsedEntry(
    guid: _guidOf(item, link),
    title: _textOf(item, 'title')?.trim().isNotEmpty == true
        ? _textOf(item, 'title')!.trim()
        : '(untitled)',
    link: link,
    author: author,
    summaryHtml: _textOf(item, 'description'),
    contentHtml: contentHtml,
    publishedAt: parseFeedDate(
      _textOf(item, 'pubDate') ?? _namespaced(item, 'date'),
    ),
    updatedAt: parseFeedDate(_namespaced(item, 'modified')),
    enclosure: enclosure,
    imageUrls: {
      ...mediaImages,
      ...enclosure.where((e) => e.isImage).map((e) => e.url.toString()),
      ..._imagesFromHtml(contentHtml),
    }.toList(),
    videoUrl: _videoOf(item, enclosure, link),
    duration: _parseDuration(_namespaced(item, 'duration')),
    doi: _extractDoi(item, link),
    pmid: _extractPmid(item, link),
    categories: item
        .findElements('category')
        .map((c) => c.innerText.trim())
        .where((c) => c.isNotEmpty)
        .toList(),
  );
}

// ---------------------------------------------------------------------------
// Atom
// ---------------------------------------------------------------------------

ParsedFeed _parseAtom(XmlElement root, Uri? feedUrl) {
  return ParsedFeed(
    title: _textOf(root, 'title') ?? _fallbackTitle(feedUrl, root),
    link: _atomLink(root),
    format: FeedFormat.atom,
    description: _textOf(root, 'subtitle'),
    updatedAt: parseFeedDate(_textOf(root, 'updated')),
    entries: root
        .findElements('entry')
        .map((entry) => _parseAtomEntry(entry))
        .toList(),
  );
}

ParsedEntry _parseAtomEntry(XmlElement entry) {
  final link = _atomLink(entry);
  final contentHtml = _textOf(entry, 'content') ?? _textOf(entry, 'summary');

  final enclosure = <ParsedEnclosure>[
    for (final linkElement in entry.findElements('link'))
      if (linkElement.getAttribute('rel') == 'enclosure' &&
          linkElement.getAttribute('href') != null)
        ParsedEnclosure(
          url: Uri.parse(linkElement.getAttribute('href')!),
          type: linkElement.getAttribute('type') ?? 'application/octet-stream',
          lengthInBytes: int.tryParse(linkElement.getAttribute('length') ?? ''),
        ),
  ];

  return ParsedEntry(
    guid:
        _textOf(entry, 'id') ??
        link?.toString() ??
        _hashTitle(_textOf(entry, 'title') ?? ''),
    title: _textOf(entry, 'title')?.trim().isNotEmpty == true
        ? _textOf(entry, 'title')!.trim()
        : '(untitled)',
    link: link,
    author:
        entry
                .getElement('author')
                ?.getElement('name')
                ?.innerText
                .trim()
                .isNotEmpty ==
            true
        ? entry.getElement('author')!.getElement('name')!.innerText.trim()
        : null,
    summaryHtml: _textOf(entry, 'summary'),
    contentHtml: contentHtml,
    publishedAt: parseFeedDate(_textOf(entry, 'published')),
    updatedAt: parseFeedDate(_textOf(entry, 'updated')),
    enclosure: enclosure,
    imageUrls: _imagesFromHtml(contentHtml),
    videoUrl: _videoOf(entry, enclosure, link),
    duration: _parseDuration(_namespaced(entry, 'duration')),
    doi: _extractDoi(entry, link),
    pmid: _extractPmid(entry, link),
    categories: entry
        .findElements('category')
        .map((c) => c.getAttribute('term') ?? c.innerText.trim())
        .where((c) => c.isNotEmpty)
        .toList(),
  );
}

// ---------------------------------------------------------------------------
// Shared field extraction helpers
// ---------------------------------------------------------------------------

String? _textOf(XmlElement parent, String localName) {
  for (final child in parent.children.whereType<XmlElement>()) {
    if (child.name.local == localName &&
        !_hasNamespacePrefix(child) &&
        child.innerText.trim().isNotEmpty) {
      return child.innerText.trim();
    }
  }
  return null;
}

/// Matches namespaced fields loosely: matches any prefix for the local name
/// (`dc:creator`, `itunes:author`, `content:encoded`, `dcterms:date`...).
String? _namespaced(XmlElement parent, String localName) {
  for (final child in parent.children.whereType<XmlElement>()) {
    if (child.name.local == localName && child.innerText.trim().isNotEmpty) {
      return child.innerText.trim();
    }
  }
  return null;
}

bool _hasNamespacePrefix(XmlElement element) =>
    element.name.qualified.contains(':');

Uri? _uriOf(String? raw) {
  if (raw == null || raw.trim().isEmpty) return null;
  return Uri.tryParse(raw.trim());
}

Uri? _atomLink(XmlElement parent) {
  Uri? alternate;
  for (final link in parent.findElements('link')) {
    final href = link.getAttribute('href');
    if (href == null) continue;
    final rel = link.getAttribute('rel') ?? 'alternate';
    final uri = Uri.tryParse(href);
    if (uri == null) continue;
    if (rel == 'alternate') return uri;
    alternate ??= uri;
  }
  return alternate;
}

Uri? _guidLink(XmlElement item) {
  final guid = _textOf(item, 'guid');
  if (guid != null && guid.startsWith('http')) {
    return Uri.tryParse(guid);
  }
  return null;
}

/// Deterministic guid fallback: guid element, then link, then title hash.
String _guidOf(XmlElement item, Uri? link) {
  final explicit = _textOf(item, 'guid');
  if (explicit != null) return explicit;
  if (link != null) return link.toString();
  return _hashTitle(_textOf(item, 'title') ?? '');
}

String _hashTitle(String title) {
  var hash = 0xcbf29ce4;
  for (final unit in title.codeUnits) {
    hash ^= unit;
    hash = (hash * 0x100000001b3) & 0xFFFFFFFF;
  }
  return 'title-${hash.toRadixString(16)}';
}

String _fallbackTitle(Uri? feedUrl, XmlElement element) =>
    _textOf(element, 'title') ?? feedUrl?.toString() ?? 'Untitled feed';

List<ParsedEnclosure> _parseEnclosures(XmlElement item) {
  return [
    for (final enclosure in item.findElements('enclosure'))
      if (enclosure.getAttribute('url') != null)
        ParsedEnclosure(
          url: Uri.parse(enclosure.getAttribute('url')!),
          type: enclosure.getAttribute('type') ?? 'application/octet-stream',
          lengthInBytes: int.tryParse(enclosure.getAttribute('length') ?? ''),
        ),
  ];
}

void _collectMediaImages(XmlElement item, List<String> output) {
  // media:thumbnail / media:content with image medium or type.
  for (final child in item.descendants.whereType<XmlElement>()) {
    final local = child.name.local;
    if (local != 'thumbnail' && local != 'content') continue;
    if (child.name.prefix case final prefix?) {
      if (prefix != 'media') continue;
    }
    final url = child.getAttribute('url');
    if (url == null) continue;
    final medium = child.getAttribute('medium')?.toLowerCase() ?? '';
    final type = child.getAttribute('type')?.toLowerCase() ?? '';
    if (local == 'thumbnail' ||
        medium == 'image' ||
        type.startsWith('image/')) {
      output.add(url);
    }
  }
}

Uri? _videoOf(XmlElement element, List<ParsedEnclosure> enclosure, Uri? link) {
  for (final e in enclosure) {
    if (e.isVideo) return e.url;
  }
  for (final child in element.descendants.whereType<XmlElement>()) {
    if (child.name.local == 'content' && child.name.prefix == 'media') {
      final medium = child.getAttribute('medium')?.toLowerCase() ?? '';
      final type = child.getAttribute('type')?.toLowerCase() ?? '';
      final url = child.getAttribute('url');
      if (url != null && (medium == 'video' || type.startsWith('video/'))) {
        return Uri.tryParse(url);
      }
    }
  }
  return _videoPlatformLink(link);
}

/// Recognizes embedded players (YouTube, Bilibili) inside plain links.
Uri? _videoPlatformLink(Uri? link) {
  if (link == null) return null;
  final host = link.host.replaceFirst('www.', '');
  final isVideoHost =
      host == 'youtube.com' ||
      host == 'm.youtube.com' ||
      host == 'youtu.be' ||
      host == 'bilibili.com' ||
      host == 'm.bilibili.com' ||
      host == 'vimeo.com';
  return isVideoHost ? link : null;
}

final _htmlImg = RegExp(
  '<img[^>]+src\\s*=\\s*["\\\']([^"\\\']+)["\\\']',
  caseSensitive: false,
);

List<String> _imagesFromHtml(String? html) {
  if (html == null) return const [];
  return _htmlImg
      .allMatches(html)
      .map((m) => m.group(1)!)
      .where((src) => src.startsWith('http'))
      .toList();
}

Duration? _parseDuration(String? raw) {
  if (raw == null || raw.trim().isEmpty) return null;
  final text = raw.trim();
  final secondsOnly = int.tryParse(text);
  if (secondsOnly != null) return Duration(seconds: secondsOnly);

  final parts = text.split(':').map(int.tryParse).toList();
  if (parts.any((part) => part == null) ||
      parts.length < 2 ||
      parts.length > 3) {
    return null;
  }
  final values = parts.cast<int>();
  return values.length == 3
      ? Duration(hours: values[0], minutes: values[1], seconds: values[2])
      : Duration(minutes: values[0], seconds: values[1]);
}

final _doiPattern = RegExp(
  r'10\.\d{4,9}/[-._;()/:A-Z0-9]+',
  caseSensitive: false,
);
final _pmidPattern = RegExp(
  r'(?:PMID\s*:?\s*|pubmed(?:\.ncbi\.nlm\.nih\.gov)?/)(\d{5,12})',
  caseSensitive: false,
);

String? _extractDoi(XmlElement element, Uri? link) {
  final candidates = <String>[
    if (link != null) link.toString(),
    for (final child in element.descendants.whereType<XmlElement>())
      if (child.name.local == 'doi' || child.name.local == 'identifier')
        child.innerText,
  ];
  for (final candidate in candidates) {
    final match = _doiPattern.firstMatch(candidate);
    if (match != null) {
      return match.group(0)?.replaceFirst(RegExp(r'[.,;]+$'), '');
    }
  }
  return null;
}

String? _extractPmid(XmlElement element, Uri? link) {
  final candidates = <String>[
    if (link != null) link.toString(),
    for (final child in element.descendants.whereType<XmlElement>())
      if (child.name.local == 'pmid' || child.name.local == 'identifier')
        child.innerText,
  ];
  for (final candidate in candidates) {
    if (RegExp(r'^\d{5,12}$').hasMatch(candidate.trim()) &&
        element.descendants.whereType<XmlElement>().any(
          (child) => child.name.local == 'pmid' && child.innerText == candidate,
        )) {
      return candidate.trim();
    }
    final match = _pmidPattern.firstMatch(candidate);
    if (match != null) return match.group(1);
  }
  return null;
}
