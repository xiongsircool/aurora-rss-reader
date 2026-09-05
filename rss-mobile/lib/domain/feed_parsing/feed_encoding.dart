import 'dart:convert';
import 'dart:typed_data';

import 'package:charset/charset.dart' as charset;
import 'package:enough_convert/enough_convert.dart' as enough;

/// Result of detecting a feed document's character encoding from raw bytes.
final class FeedEncoding {
  const FeedEncoding({required this.encoding, required this.hasBom});

  /// Canonical encoding name accepted by [Encoding.getByName].
  final String encoding;

  /// Whether a byte-order mark was consumed before the document body.
  final bool hasBom;
}

/// Thrown when bytes cannot be decoded with the detected encoding.
final class FeedDecodingException implements Exception {
  const FeedDecodingException(this.message);

  final String message;

  @override
  String toString() => 'FeedDecodingException: $message';
}

const _utf8Bom = [0xEF, 0xBB, 0xBF];
const _utf16LeBom = [0xFF, 0xFE];
const _utf16BeBom = [0xFE, 0xFF];

/// Detects a feed document's encoding from raw bytes.
///
/// Precedence follows the XML specification:
/// 1. Byte-order mark
/// 2. XML declaration `encoding="..."`
/// 3. UTF-8 default
///
/// GBK/GB18030 is normalized to `gb18030` because Dart's converters alias it,
/// and gb18030 is a superset that decodes all valid GBK documents.
FeedEncoding detectFeedEncoding(Uint8List bytes) {
  if (_startsWith(bytes, _utf8Bom)) {
    return const FeedEncoding(encoding: 'utf-8', hasBom: true);
  }
  if (_startsWith(bytes, _utf16LeBom)) {
    return const FeedEncoding(encoding: 'utf-16le', hasBom: true);
  }
  if (_startsWith(bytes, _utf16BeBom)) {
    return const FeedEncoding(encoding: 'utf-16be', hasBom: true);
  }

  final declared = _encodingFromXmlDeclaration(bytes);
  if (declared != null) {
    return FeedEncoding(encoding: _normalizeEncoding(declared), hasBom: false);
  }
  return const FeedEncoding(encoding: 'utf-8', hasBom: false);
}

/// Decodes raw feed bytes into a String using detected encoding.
String decodeFeedBytes(Uint8List bytes) {
  final detected = detectFeedEncoding(bytes);
  return _decodeBytes(bytes, detected);
}

/// Decodes an HTML response using BOM, HTTP Content-Type, then meta charset.
String decodeHtmlBytes(Uint8List bytes, {String? contentType}) {
  final bom = detectFeedEncoding(bytes);
  if (bom.hasBom) return _decodeBytes(bytes, bom);

  final declared =
      _charsetFromContentType(contentType) ?? _charsetFromHtml(bytes);
  return _decodeBytes(
    bytes,
    FeedEncoding(
      encoding: declared == null ? 'utf-8' : _normalizeEncoding(declared),
      hasBom: false,
    ),
  );
}

String _decodeBytes(Uint8List bytes, FeedEncoding detected) {
  try {
    if (detected.encoding == 'utf-16le') {
      return const charset.Utf16Decoder().decodeUtf16Le(bytes);
    }
    if (detected.encoding == 'utf-16be') {
      return const charset.Utf16Decoder().decodeUtf16Be(bytes);
    }

    final body = detected.hasBom ? _stripBom(bytes, detected.encoding) : bytes;
    final converter = _resolveEncoding(detected.encoding);
    if (converter == null) {
      throw FeedDecodingException('Unknown encoding: ${detected.encoding}');
    }
    return converter.decode(body);
  } on FormatException catch (error) {
    throw FeedDecodingException(
      'Failed to decode ${detected.encoding}: ${error.message}',
    );
  } on ArgumentError catch (error) {
    throw FeedDecodingException(
      'Cannot decode ${detected.encoding}: ${error.message}',
    );
  }
}

/// Resolves an encoding name to a decoder.
///
/// `dart:convert` only registers a small set (utf/latin/ascii), so CJK
/// encodings needed by Chinese/Japanese feeds come from `enough_convert`.
Encoding? _resolveEncoding(String name) {
  final builtin = Encoding.getByName(name);
  if (builtin != null) return builtin;
  switch (name) {
    case 'utf-16':
      return const charset.Utf16Codec();
    case 'gb18030':
    case 'gbk':
      // The pure-Dart codec covers GBK/GB2312 and the two-byte GB18030
      // subset. Four-byte GB18030 sequences remain an explicit M0 gap.
      return const charset.GbkCodec(allowMalformed: true);
    case 'big5':
      return const enough.Big5Codec(allowInvalid: true);
    case 'shift-jis':
    case 'shift-jis-x0213':
      return const charset.ShiftJISCodec(allowMalformed: true);
    default:
      return null;
  }
}

bool _startsWith(Uint8List bytes, List<int> prefix) {
  if (bytes.length < prefix.length) return false;
  for (var i = 0; i < prefix.length; i++) {
    if (bytes[i] != prefix[i]) return false;
  }
  return true;
}

Uint8List _stripBom(Uint8List bytes, String encoding) {
  switch (encoding) {
    case 'utf-8':
      return Uint8List.sublistView(bytes, 3);
    case 'utf-16le':
    case 'utf-16be':
      return Uint8List.sublistView(bytes, 2);
    default:
      return bytes;
  }
}

String? _charsetFromContentType(String? contentType) {
  if (contentType == null) return null;
  return RegExp(
    r'''charset\s*=\s*["']?([^;"'\s]+)''',
    caseSensitive: false,
  ).firstMatch(contentType)?.group(1);
}

String? _charsetFromHtml(Uint8List bytes) {
  final scanLimit = bytes.length < 4096 ? bytes.length : 4096;
  final window = latin1.decode(Uint8List.sublistView(bytes, 0, scanLimit));
  return RegExp(
        r'''<meta[^>]+charset\s*=\s*["']?([^"'\s/>;]+)''',
        caseSensitive: false,
      ).firstMatch(window)?.group(1) ??
      RegExp(
        r'''<meta[^>]+content\s*=\s*["'][^"']*charset=([^;"'\s]+)''',
        caseSensitive: false,
      ).firstMatch(window)?.group(1);
}

/// Scans the first bytes for an XML declaration and extracts encoding="...".
String? _encodingFromXmlDeclaration(Uint8List bytes) {
  // The declaration must appear within the first 1KB and starts with "<?xml".
  final scanLimit = bytes.length < 1024 ? bytes.length : 1024;
  const prologue = '<?xml';
  if (scanLimit < prologue.length) return null;
  for (var i = 0; i < prologue.length; i++) {
    if (bytes[i] != prologue.codeUnitAt(i)) return null;
  }

  // The declaration is ASCII-compatible in practice; parse it as latin1 so
  // that multi-byte content after the encoding token never breaks scanning.
  final window = latin1.decode(Uint8List.sublistView(bytes, 0, scanLimit));
  final end = window.indexOf('?>');
  if (end < 0) return null;
  final declaration = window.substring(0, end);

  final match = RegExp(
    'encoding\\s*=\\s*["\\\']([^"\\\']+)["\\\']',
    caseSensitive: false,
  ).firstMatch(declaration);
  return match?.group(1);
}

String _normalizeEncoding(String name) {
  final lower = name.toLowerCase().replaceAll('_', '-');
  switch (lower) {
    case 'gbk':
    case 'gb2312':
    case 'gb18030':
      return 'gb18030';
    case 'utf8':
      return 'utf-8';
    case 'big5':
      return 'big5';
    case 'shift-jis':
    case 'shiftjis':
    case 'sjis':
      return 'shift-jis';
    default:
      return lower;
  }
}
