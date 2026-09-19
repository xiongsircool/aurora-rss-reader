import 'package:flutter_test/flutter_test.dart';
import 'package:aurora_mobile/domain/entities/entry.dart';
import 'package:aurora_mobile/shared/export/citation_exporter.dart';

Entry _entry({
  String? author,
  String? doi,
  String? pmid,
  String? url,
  String title = 'A Study of Rare Diseases in China',
  DateTime? publishedAt,
}) {
  return Entry(
    id: 'e1',
    feedId: 'f1',
    guid: 'g1',
    title: title,
    author: author,
    url: url == null ? null : Uri.parse(url),
    doi: doi,
    pmid: pmid,
    publishedAt: publishedAt ?? DateTime(2025, 9, 18),
    insertedAt: DateTime(2025, 9, 18),
  );
}

void main() {
  group('parseAuthors', () {
    test('splits semicolons, Chinese enumerators, and "and"', () {
      expect(parseAuthors('Zhang San; Li Si'), ['Zhang San', 'Li Si']);
      expect(parseAuthors('张三、李四'), ['张三', '李四']);
      expect(parseAuthors('John Doe and Jane Roe'), ['John Doe', 'Jane Roe']);
      expect(parseAuthors(null), isEmpty);
      expect(parseAuthors('  '), isEmpty);
    });
  });

  group('bibAuthorName', () {
    test('converts ASCII names to Last, First', () {
      expect(bibAuthorName('Zhang San'), 'Zhang, San');
      expect(bibAuthorName('San Zhang'), 'Zhang, San');
    });

    test('keeps Chinese names verbatim', () {
      expect(bibAuthorName('张三'), '张三');
    });

    test('respects existing Last, First', () {
      expect(bibAuthorName('Doe, John'), 'Doe, John');
    });
  });

  group('toBibTeX', () {
    test('produces @article with authors, journal, doi', () {
      final bib = toBibTeX(
        _entry(
          author: 'Zhang San; Li Si',
          doi: '10.1038/s41586-025-00001-x',
          url: 'https://example.com/paper',
        ),
        'Nature News',
      );
      expect(bib, startsWith('@article{zhang2025study,'));
      expect(bib, contains('author = {Zhang, San and Li, Si},'));
      expect(bib, contains('journal = {Nature News},'));
      expect(bib, contains('doi = {10.1038/s41586-025-00001-x},'));
      expect(bib, contains('year = {2025},'));
      // URL is kept alongside DOI as the direct-access fallback.
      expect(bib, contains('url = {https://example.com/paper},'));
    });

    test('PMID adds pubmed url', () {
      final bib = toBibTeX(_entry(author: 'Doe, John', pmid: '3987654'), 'BMJ');
      expect(bib, contains('pmid = {3987654},'));
      expect(bib, contains('https://pubmed.ncbi.nlm.nih.gov/3987654/'));
    });

    test('no author degrades to @misc + howpublished', () {
      final bib = toBibTeX(_entry(url: 'https://example.com/x'), '生物世界');
      expect(bib, startsWith('@misc{'));
      expect(bib, contains('howpublished'));
      expect(bib, contains('url = {https://example.com/x},'));
    });

    test('escapes BibTeX special characters in titles', () {
      final bib = toBibTeX(
        _entry(author: 'Ann Lee', title: '100% C++ & Rust_2.0 #fast'),
        'ACM',
      );
      expect(bib, contains('C++'));
      expect(bib, contains(r'\&'));
      expect(bib, contains(r'Rust\_2.0'));
      expect(bib, contains(r'\#fast'));
    });

    test('Chinese titles survive as UTF-8', () {
      final bib = toBibTeX(
        _entry(
          author: '张三',
          title: '单细胞测序技术最新综述',
          url: 'https://example.com/cn',
        ),
        '生物世界',
      );
      // Chinese author cannot be romanized: feed title becomes the surname.
      expect(bib, contains('title = {{单细胞测序技术最新综述}}'));
      expect(bib, contains('author = {张三}'));
    });
  });

  group('toBibTeXCollections', () {
    test('joins entries with blank lines', () {
      final out = toBibTeXCollections([
        (_entry(author: 'Ann Lee'), 'ACM'),
        (_entry(author: 'Bo Chen'), 'IEEE'),
      ]);
      expect(out, contains('@article{lee2025study'));
      expect(out, contains('@article{chen2025study'));
      expect(out, contains('}\n\n@article'));
    });
  });

  group('toFrontMatter', () {
    test('emits YAML metadata for archiving', () {
      final fm = toFrontMatter(
        _entry(author: 'Zhang San', doi: '10.1/x', pmid: '123'),
        '生物世界',
      );
      expect(fm, startsWith('---\n'));
      expect(fm, contains('title: "A Study of Rare Diseases in China"'));
      expect(fm, contains('source: "生物世界"'));
      expect(fm, contains('doi: 10.1/x'));
      expect(fm, contains('pmid: 123'));
      expect(fm, contains('authors:'));
      expect(fm, contains('- "Zhang San"'));
      expect(fm, contains('date: 2025-09-18'));
      expect(fm, contains('tags: [aurora, 生物世界]'));
      expect(fm, endsWith('---'));
    });

    test('omits absent optional fields', () {
      final fm = toFrontMatter(_entry(), '');
      expect(fm, isNot(contains('doi:')));
      expect(fm, isNot(contains('authors:')));
      expect(fm, isNot(contains('source:')));
      expect(fm, contains('tags: [aurora]'));
    });
  });
}
