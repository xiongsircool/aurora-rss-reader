import '../../domain/entities/entry.dart';

/// Pure citation exporters — no UI, no I/O, fully unit-testable.
///
/// * [toBibTeX] produces a reference-manager-friendly entry (Zotero,
///   JabRef, Overleaf/biber all import UTF-8 natively).
/// * [toFrontMatter] produces a YAML front-matter block for
///   Obsidian/Notion-style archival Markdown.
String toBibTeX(Entry entry, String feedTitle) {
  final date = entry.publishedAt ?? entry.insertedAt;
  final year = date.year.toString();
  final authors = parseAuthors(entry.author);
  final hasAuthors = authors.isNotEmpty;
  final type = hasAuthors ? 'article' : 'misc';
  final key = citeKey(
    authors: authors,
    feedTitle: feedTitle,
    title: entry.title,
    year: year,
    fallbackSeed: entry.id,
  );

  final b = StringBuffer('@$type{$key,\n');
  // Double braces protect capitalization during BibTeX style processing.
  b.writeln('  title = {{${_escape(_oneLine(entry.title))}}},');
  if (hasAuthors) {
    b.writeln('  author = {${authors.map(bibAuthorName).join(' and ')}},');
  }
  if (feedTitle.trim().isNotEmpty) {
    b.writeln(
      '  ${hasAuthors ? 'journal' : 'howpublished'} = {${_escape(_oneLine(feedTitle))}},',
    );
  }
  b.writeln('  year = {$year},');
  b.writeln('  month = {${date.month}},');
  final doi = entry.doi?.trim();
  final pmid = entry.pmid?.trim();
  if (doi != null && doi.isNotEmpty) b.writeln('  doi = {$doi},');
  if (pmid != null && pmid.isNotEmpty) {
    b.writeln('  pmid = {$pmid},');
    b.writeln(
      '  url = {https://pubmed.ncbi.nlm.nih.gov/$pmid/},',
    );
  } else {
    final url = entry.url?.toString() ?? '';
    if (url.isNotEmpty) b.writeln('  url = {$url},');
  }
  b.writeln('  urldate = {${_isoDate(DateTime.now())}},');
  b.writeln('  note = {Retrieved via Aurora RSS Reader},');
  b.write('}');
  return b.toString();
}

/// Joins multiple entries into one `.bib` file body (blank line between
/// entries, as expected by BibTeX tools).
String toBibTeXCollections(Iterable<(Entry, String)> items) =>
    items.map((i) => toBibTeX(i.$1, i.$2)).join('\n\n');

/// YAML front-matter for Obsidian-style archival Markdown.
String toFrontMatter(Entry entry, String feedTitle) {
  final date = entry.publishedAt ?? entry.insertedAt;
  final authors = parseAuthors(entry.author);
  final b = StringBuffer('---\n');
  b.writeln('title: "${_yaml(entry.title)}"');
  if (feedTitle.trim().isNotEmpty) b.writeln('source: "${_yaml(feedTitle)}"');
  final url = entry.url?.toString() ?? '';
  if (url.isNotEmpty) b.writeln('url: $url');
  final doi = entry.doi?.trim();
  final pmid = entry.pmid?.trim();
  if (doi != null && doi.isNotEmpty) b.writeln('doi: $doi');
  if (pmid != null && pmid.isNotEmpty) b.writeln('pmid: $pmid');
  if (authors.isNotEmpty) {
    b.writeln('authors:');
    for (final a in authors) {
      b.writeln('  - "${_yaml(a)}"');
    }
  }
  b.writeln('date: ${_isoDate(date)}');
  final tags = [
    'aurora',
    if (feedTitle.trim().isNotEmpty) feedTitle.trim(),
  ].map((t) => _tag(t)).join(', ');
  b.writeln('tags: [$tags]');
  b.write('---');
  return b.toString();
}

// ---------------------------------------------------------------------------
// Author handling
// ---------------------------------------------------------------------------

/// Splits a free-form RSS author string into individual names.
///
/// RSS feeds disagree wildly: "Zhang San", "Zhang San; Li Si",
/// "张三、李四", "Doe, John and Doe, Jane". We split on the unambiguous
/// separators (`;`, `、`, `/`, ` and `) and keep each name verbatim;
/// [bibAuthorName] normalizes the rest.
List<String> parseAuthors(String? raw) {
  if (raw == null) return const [];
  return raw
      .split(RegExp(r'\s*;\s*|\s*、\s*|\s*/\s*|\s+and\s+'))
      .map((s) => s.trim())
      .where((s) => s.isNotEmpty && s.toLowerCase() != 'unknown')
      .toList();
}

/// Common Chinese pinyin surnames, lowercase. Used to disambiguate
/// two-token ASCII names: "Zhang San" (surname-first, Chinese convention)
/// vs "San Zhang" / "John Doe" (given-first, Western convention).
const _pinyinSurnames = {
  'zhang', 'wang', 'li', 'liu', 'chen', 'yang', 'huang', 'zhao', 'wu',
  'zhou', 'xu', 'sun', 'ma', 'zhu', 'hu', 'guo', 'lin', 'luo', 'zheng',
  'liang', 'xie', 'song', 'tang', 'deng', 'feng', 'han', 'cao', 'zeng',
  'peng', 'xiao', 'cai', 'pan', 'tian', 'dong', 'yuan', 'yu', 'ye', 'du',
  'su', 'wei', 'cheng', 'lu', 'ding', 'ren', 'shen', 'yao', 'jiang',
  'qian', 'duan', 'lei', 'hou', 'bai', 'gu', 'meng', 'long', 'qiu', 'shi',
};

/// Normalizes one name to BibTeX "Last, First" order when it is an ASCII
/// multi-token name. Chinese names are kept verbatim (the whole name is
/// effectively the surname in Chinese convention).
String bibAuthorName(String name) {
  final cleaned = _oneLine(name);
  if (cleaned.contains(',')) return cleaned; // Already "Last, First".
  final tokens = cleaned.split(RegExp(r'\s+'));
  if (tokens.length < 2 || !cleaned.isAscii) return cleaned;
  // Two-token ASCII name: prefer surname-first when the first token is a
  // common Chinese pinyin surname (Aurora's audience is Chinese-first).
  if (tokens.length == 2 &&
      _pinyinSurnames.contains(tokens.first.toLowerCase())) {
    return '${tokens[0]}, ${tokens[1]}';
  }
  final last = tokens.removeLast();
  return '$last, ${tokens.join(' ')}';
}

// ---------------------------------------------------------------------------
// Cite key
// ---------------------------------------------------------------------------

/// Builds a cite key like `zhang2025singlecell`.
///
/// Preference order for the surname: first ASCII author surname → feed
/// title → `aurora`. Chinese text cannot be romanized offline, so we fall
/// back rather than emit garbage.
String citeKey({
  required List<String> authors,
  required String feedTitle,
  required String title,
  required String year,
  required String fallbackSeed,
}) {
  String? surname;
  for (final a in authors) {
    final ascii = a.isAscii;
    if (ascii) {
      surname = bibAuthorName(a).split(',').first.trim();
      break;
    }
  }
  final feed = _alnum(feedTitle);
  if (surname == null && feed.isNotEmpty) surname = feed;
  surname = _alnum(surname ?? 'aurora').toLowerCase();
  if (surname.isEmpty) surname = 'aurora';

  final keyword =
      _firstAsciiWord(title) ?? _alnum(fallbackSeed).toLowerCase();
  final kw = keyword.isEmpty ? 'entry' : keyword;
  return '$surname$year$kw';
}

// ---------------------------------------------------------------------------
// Escaping helpers
// ---------------------------------------------------------------------------

const _bibEscapes = {
  r'%': r'\%',
  r'&': r'\&',
  r'$': r'\$',
  r'#': r'\#',
  r'_': r'\_',
  r'{': r'\{',
  r'}': r'\}',
  r'~': r'\~',
  r'^': r'\^',
};

String _escape(String s) => s.replaceAllMapped(
      RegExp(r'[%&$#_{}~^]'),
      (m) => _bibEscapes[m[0]]!,
    );

String _oneLine(String s) =>
    s.replaceAll(RegExp(r'\s+'), ' ').trim();

String _isoDate(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-'
    '${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

String _yaml(String s) =>
    _oneLine(s).replaceAll('\\', '\\\\').replaceAll('"', r'\"');

String _tag(String s) =>
    s.replaceAll(RegExp(r'[^0-9a-zA-Z\u4e00-\u9fff]+'), '-');

String _alnum(String s) => s.replaceAll(RegExp(r'[^0-9a-zA-Z]'), '');

String? _firstAsciiWord(String s) {
  for (final m in RegExp(r'[A-Za-z]{4,}').allMatches(s)) {
    return m[0]!.toLowerCase();
  }
  return null;
}

extension _StringIsAscii on String {
  /// True when every character is plain ASCII (fast code-unit check).
  bool get isAscii {
    for (final cu in codeUnits) {
      if (cu > 127) return false;
    }
    return true;
  }
}
