/// Text pipeline for TTS: strips non-spoken markup (code, tables,
/// figures) from article HTML, then splits the remaining text into
/// speech-sized sentences.
///
/// Splitting guards:
/// - decimals ("3.5", "v1.2") never split at their dots
/// - common latin abbreviations ("e.g.", "i.e.", "Mr.") never split
/// - CJK terminators (。！？…；) split without needing a following space
/// - latin terminators require following whitespace + capital/digit
/// - fragments shorter than 8 chars merge forward; sentences longer
///   than 240 chars hard-split at the last soft separator
library;

/// Upper bound for one utterance. Very long sentences are hard-split
/// so platform TTS engines keep natural pacing and progress granular.
const int kMaxSentenceLength = 240;

/// Minimum length for a standalone sentence; shorter fragments merge
/// with the following sentence.
const int kMinSentenceLength = 8;

/// Blocks that are never spoken aloud.
final RegExp _silentBlocks = RegExp(
  r'<(script|style|pre|code|table|figure|iframe|svg|noscript)[^>]*>.*?</\1\s*>',
  multiLine: true,
  caseSensitive: false,
  dotAll: true,
);

/// Tags that imply a paragraph break when stripped.
final RegExp _blockTags = RegExp(
  r'</?(p|div|section|article|blockquote|li|h[1-6]|br|tr|ul|ol|dl|dd|dt)\b[^>]*>',
  multiLine: true,
  caseSensitive: false,
);

final RegExp _anyTag = RegExp(r'<[^>]+>');

/// Latin abbreviations whose trailing dot must not end a sentence.
const Set<String> _abbreviations = <String>{
  'mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'jr', 'sr', 'vs', 'etc',
  'e.g', 'i.e', 'fig', 'no', 'inc', 'ltd', 'co', 'u.s', 'u.k',
};

/// Converts article HTML into a list of speakable sentences.
List<String> splitIntoSentences(String? html) {
  if (html == null || html.trim().isEmpty) return const [];
  final text = _plainText(html);
  if (text.isEmpty) return const [];

  final sentences = <String>[];
  for (final paragraph in text.split(RegExp(r'\n+'))) {
    final trimmed = paragraph.trim();
    if (trimmed.isEmpty) continue;
    _splitParagraph(trimmed, sentences);
  }
  return sentences;}

String _plainText(String html) {
  var text = html
      .replaceAll(_silentBlocks, ' ')
      .replaceAllMapped(_blockTags, (_) => '\n')
      .replaceAll(_anyTag, ' ')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&nbsp;', ' ')
      .replaceAll(RegExp(r'[ \t\u3000]+'), ' ');
  return text.replaceAll(RegExp(r'\n{2,}'), '\n');
}

void _splitParagraph(String paragraph, List<String> out) {
  final buffer = StringBuffer();
  var length = 0;

  /// [terminated] sentences always stand alone; only an unterminated
  /// paragraph leftover merges into its neighbour when too short.
  void flush(bool terminated) {
    final sentence = buffer.toString().trim();
    buffer.clear();
    length = 0;
    if (sentence.isEmpty) return;
    final glue = sentence.startsWith(RegExp(r'[\u2E80-\u9FFF]')) ? '' : ' ';
    final mergeable =
        !terminated &&
        out.isNotEmpty &&
        _infoLength(sentence) < kMinSentenceLength;
    if (mergeable) {
      out[out.length - 1] = out.last + glue + sentence;
      return;
    }
    out.add(sentence);
  }

  for (var i = 0; i < paragraph.length; i++) {
    final ch = paragraph[i];
    buffer.write(ch);
    length++;

    if (length >= kMaxSentenceLength) {
      _hardSplit(buffer, out);
      length = 0;
      continue;
    }

    final cjkEnd = ch == '。' || ch == '！' || ch == '？' || ch == '…' || ch == '；';
    if (cjkEnd) {
      flush(true);
      continue;
    }

    if (ch == '.' || ch == '!' || ch == '?') {
      // Decimal/version numbers: digit on both sides of the dot.
      if (ch == '.' &&
          i > 0 &&
          i + 1 < paragraph.length &&
          _isDigit(paragraph[i - 1]) &&
          _isDigit(paragraph[i + 1])) {
        continue;
      }
      // Abbreviations like "e.g." — never terminate.
      if (ch == '.' && _endsWithAbbreviation(buffer.toString())) {
        continue;
      }
      // Latin terminators need whitespace + capital/digit/quote ahead.
      final ahead = _lookAhead(paragraph, i + 1);
      if (ahead == null) continue;
      flush(true);
      i = ahead - 1;
    }
  }
  if (buffer.isNotEmpty) flush(false);
}

/// Information weight of a fragment: CJK chars carry twice a latin
/// char, so short-but-dense CJK fragments stay standalone.
int _infoLength(String text) {
  var weight = 0;
  for (final ch in text.runes) {
    weight += ch > 0x2E7F ? 2 : 1;
  }
  return weight;
}

/// Index of the first character of the next sentence, skipping the
/// separator whitespace. Returns null when the terminator does not
/// really end the sentence (no following capital/digit/quote).
int? _lookAhead(String paragraph, int from) {
  var i = from;
  while (i < paragraph.length && (paragraph[i] == ' ' || paragraph[i] == '"')) {
    i++;
  }
  if (i >= paragraph.length) return i; // end of paragraph
  final next = paragraph[i];
  final startsSentence =
      _isUpperCase(next) || _isDigit(next) || next == '"' || _isCjk(next);
  if (!startsSentence) return null;
  return i;
}

void _hardSplit(StringBuffer buffer, List<String> out) {
  var text = buffer.toString();
  buffer.clear();
  final soft = text.lastIndexOf(RegExp(r'[，、,;；:：\s]'));
  if (soft > kMinSentenceLength) {
    out.add(text.substring(0, soft).trim());
    buffer.write(text.substring(soft + 1));
  } else {
    out.add(text.trim());
  }
}

bool _endsWithAbbreviation(String text) {
  final match = RegExp(r'([A-Za-z.]+)\.$').firstMatch(text);
  if (match == null) return false;
  return _abbreviations.contains(match.group(1)!.toLowerCase());
}

bool _isDigit(String ch) =>
    ch.codeUnitAt(0) >= 0x30 && ch.codeUnitAt(0) <= 0x39;

bool _isUpperCase(String ch) =>
    ch != ch.toLowerCase() && ch == ch.toUpperCase() && !ch.contains(' ');

bool _isCjk(String ch) =>
    ch.codeUnitAt(0) > 0x2E7F;
