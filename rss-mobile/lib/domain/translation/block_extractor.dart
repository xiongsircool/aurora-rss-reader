import 'package:html/parser.dart' as html_parser;
import 'package:html/dom.dart' as html_dom;

/// Represents a translatable block extracted from HTML content.
/// Each block is a paragraph-level unit suitable for individual translation.
class TranslatableBlock {
  const TranslatableBlock({
    required this.id,
    required this.sourceText,
    this.translatedText = '',
    this.isTranslating = false,
    this.isHeading = false,
    this.isListItem = false,
  });

  final int id;

  /// The plain text to translate.
  final String sourceText;

  /// The translated text (empty if not yet translated).
  final String translatedText;

  final bool isTranslating;
  final bool isHeading;
  final bool isListItem;

  bool get isTranslated => translatedText.isNotEmpty;
  bool get isNonText => sourceText.trim().isEmpty;

  TranslatableBlock copyWith({String? translatedText, bool? isTranslating}) {
    return TranslatableBlock(
      id: id,
      sourceText: sourceText,
      translatedText: translatedText ?? this.translatedText,
      isTranslating: isTranslating ?? this.isTranslating,
      isHeading: isHeading,
      isListItem: isListItem,
    );
  }
}

/// Splits HTML content into paragraph-level translatable blocks.
///
/// Mimics the immersive-translate approach: walk the DOM, extract
/// text-bearing elements (p, h1-h6, li, blockquote), and pair each
/// with its translation slot.
List<TranslatableBlock> extractTranslatableBlocks(String html) {
  final doc = html_parser.parseFragment(html);
  final blocks = <TranslatableBlock>[];
  var id = 0;

  // Tags that represent translatable text units.
  const blockTags = {
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'li',
    'blockquote',
    'figcaption',
    'dd',
    'dt',
  };

  for (final element in doc.querySelectorAll('*')) {
    if (!blockTags.contains(element.localName)) continue;

    // Skip if inside a nested block (we handle the outermost).
    if (_hasBlockParent(element, blockTags)) continue;

    final text = element.text.trim();
    if (text.length < 2) continue; // Skip empty/trivial text.
    if (!_isLikelyNonChinese(text)) continue; // Skip Chinese text.

    blocks.add(
      TranslatableBlock(
        id: id++,
        sourceText: text,
        isHeading: element.localName!.startsWith('h'),
        isListItem: element.localName == 'li',
      ),
    );
  }

  // If no block tags found, fall back to splitting by double newlines.
  if (blocks.isEmpty) {
    final plain = doc.text?.trim() ?? '';
    if (plain.isNotEmpty && _isLikelyNonChinese(plain)) {
      final paragraphs = plain.split(RegExp(r'\n\s*\n'));
      for (final p in paragraphs) {
        final trimmed = p.trim();
        if (trimmed.length >= 2) {
          blocks.add(TranslatableBlock(id: id++, sourceText: trimmed));
        }
      }
    }
  }

  return blocks;
}

bool _hasBlockParent(html_dom.Element element, Set<String> blockTags) {
  var parent = element.parent;
  while (parent != null) {
    if (blockTags.contains(parent.localName)) return true;
    parent = parent.parent;
  }
  return false;
}

/// Heuristic: >70% non-CJK characters suggests translation is useful.
bool _isLikelyNonChinese(String text) {
  if (text.isEmpty) return false;
  final cjkCount = RegExp(r'[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]')
      .allMatches(text)
      .length;
  return cjkCount < text.length * 0.3;
}
