import 'package:html/parser.dart' as html_parser;

/// Estimates reading time from article HTML: CJK characters at ~400/min,
/// Latin words at ~220/min. Returns a Chinese display string.
String readingTimeEstimate(String? html) {
  if (html == null || html.isEmpty) return '';
  final fragment = html_parser.parseFragment(html);
  // Script/style bodies are not readable content.
  for (final selector in ['script', 'style']) {
    for (final element in fragment.querySelectorAll(selector)) {
      element.remove();
    }
  }
  final text = fragment.text ?? '';
  if (text.trim().isEmpty) return '';

  final cjk = RegExp(r'[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]')
      .allMatches(text)
      .length;
  // Latin word boundaries require whitespace/punctuation, so count on
  // the original text rather than a whitespace-stripped copy.
  final latinWords = RegExp(r'[A-Za-z]+').allMatches(text).length;

  final rawMinutes = cjk / 400 + latinWords / 220;
  if (rawMinutes < 1) return '不到 1 分钟';
  return '约 ${rawMinutes.ceil()} 分钟读完';
}
