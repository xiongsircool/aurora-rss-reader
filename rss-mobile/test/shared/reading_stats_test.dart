import 'package:aurora_mobile/shared/reading_stats.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('readingTimeEstimate', () {
    test('returns empty for null/empty/tag-only html', () {
      expect(readingTimeEstimate(null), '');
      expect(readingTimeEstimate(''), '');
      expect(readingTimeEstimate('<p></p>'), '');
      expect(readingTimeEstimate('<script>var x=1;</script>'), '');
    });

    test('short CJK text is under a minute', () {
      expect(readingTimeEstimate('<p>你好世界</p>'), '不到 1 分钟');
    });

    test('long CJK text scales at 400 chars per minute', () {
      final html = '<p>${'汉' * 800}</p>';
      expect(readingTimeEstimate(html), '约 2 分钟读完');
    });

    test('latin words scale at 220 per minute', () {
      final html = '<p>${List.filled(440, 'word').join(' ')}</p>';
      expect(readingTimeEstimate(html), '约 2 分钟读完');
    });

    test('mixed CJK and latin accumulates', () {
      final html = '<p>${'汉' * 200} ${List.filled(110, 'w').join(' ')}</p>';
      expect(readingTimeEstimate(html), '约 1 分钟读完');
    });

    test('html tags do not count as content', () {
      final bare = readingTimeEstimate('汉字内容');
      final wrapped = readingTimeEstimate(
        '<div><p class="x">汉字内容</p><img src="a.png"/></div>',
      );
      expect(wrapped, bare);
    });
  });
}
