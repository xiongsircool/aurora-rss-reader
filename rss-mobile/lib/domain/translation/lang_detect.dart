/// Lightweight language detection based on Unicode character ranges.
/// Sufficient for deciding whether to auto-translate, not for
/// precise NLP tasks.
String detectSourceLang(String text) {
  if (text.trim().isEmpty) return 'unknown';

  final cjkHan = RegExp(r'[\u4e00-\u9fff]').allMatches(text).length;
  final cjkHiragana = RegExp(r'[\u3040-\u309f]').allMatches(text).length;
  final cjkKatakana = RegExp(r'[\u30a0-\u30ff]').allMatches(text).length;
  final hangul = RegExp(r'[\uac00-\ud7af]').allMatches(text).length;
  final cyrillic = RegExp(r'[\u0400-\u04ff]').allMatches(text).length;
  final latin = RegExp(r'[a-zA-Z]').allMatches(text).length;

  // Count total non-whitespace, non-punctuation characters.
  final meaningful = text.replaceAll(RegExp(r'[\s\d\p{P}]', unicode: true), '');
  if (meaningful.isEmpty) return 'unknown';
  final total = meaningful.length;

  // If >30% Chinese characters, it's Chinese.
  if (cjkHan / total > 0.3) return 'zh';
  // If >30% Hiragana+Katakana, it's Japanese.
  if ((cjkHiragana + cjkKatakana) / total > 0.3) return 'ja';
  // If >30% Hangul, it's Korean.
  if (hangul / total > 0.3) return 'ko';
  // If >30% Cyrillic, it's Russian.
  if (cyrillic / total > 0.3) return 'ru';
  // If >50% Latin, it's likely English (or another Latin-script language).
  if (latin / total > 0.5) return 'en';

  return 'unknown';
}

/// Returns true if the entry's source language differs from the target
/// translation language (i.e., translation is useful).
bool shouldTranslate(String sourceLang, String targetLang) {
  if (sourceLang == 'unknown') return false;
  return sourceLang != targetLang;
}
