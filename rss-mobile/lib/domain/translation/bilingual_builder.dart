import 'package:html/parser.dart' as html_parser;

/// Builds bilingual HTML by inserting translated paragraphs directly
/// below their source paragraphs in the original HTML structure.
///
/// This is the "immersive translate" approach: the translation appears
/// inline, right after each source paragraph, not in a separate section.
String buildBilingualHtml({
  required String originalHtml,
  required Map<String, String> translations,
}) {
  final doc = html_parser.parseFragment(originalHtml);

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

  for (final element in doc.querySelectorAll('*').toList()) {
    if (!blockTags.contains(element.localName)) continue;
    if (_hasBlockParent(element, blockTags)) continue;

    final text = element.text.trim();
    if (text.length < 2) continue;

    final translated = translations[text];
    if (translated == null || translated.trim().isEmpty) continue;

    // Create a translated paragraph element.
    final translatedElement = html_parser
        .parseFragment(
          '<${_translatedTag(element.localName!)} class="aurora-translation">'
          '${_escapeHtml(translated)}</${_translatedTag(element.localName!)}>',
        )
        .firstChild;

    if (translatedElement != null) {
      // Insert after the source element.
      element.parent?.insertBefore(
        translatedElement,
        element.nextElementSibling,
      );
    }
  }

  return doc.outerHtml;
}

String _translatedTag(String sourceTag) {
  // Headings stay as headings but one level lower for visual hierarchy.
  if (sourceTag.startsWith('h')) {
    final level = int.tryParse(sourceTag.substring(1)) ?? 2;
    return 'h${(level + 1).clamp(3, 6)}';
  }
  if (sourceTag == 'li') return 'li'; // Translations stay in list.
  return 'p';
}

String _escapeHtml(String text) {
  return text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
}

bool _hasBlockParent(dynamic element, Set<String> blockTags) {
  var parent = element.parent;
  while (parent != null) {
    if (blockTags.contains(parent.localName)) return true;
    parent = parent.parent;
  }
  return false;
}
