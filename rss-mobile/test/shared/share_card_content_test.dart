import 'package:aurora_mobile/shared/share_card_content.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'cover first, then relative and lazy body images with deduplication',
    () {
      final result = ShareCardContent.fromHtml(
        cover: Uri.parse('https://example.com/cover.jpg'),
        baseUrl: Uri.parse('https://example.com/posts/article'),
        html:
            '<p>Hello <b>world</b></p><p>Next paragraph</p>'
            '<img src="https://example.com/cover.jpg">'
            '<img data-src="../photo.jpg" src="data:image/gif;base64,AAAA">'
            '<img src="//cdn.example.com/picture.png">',
      );
      expect(result.excerpt, 'Hello world Next paragraph');
      expect(result.images.map((uri) => uri.toString()), [
        'https://example.com/cover.jpg',
        'https://example.com/photo.jpg',
        'https://cdn.example.com/picture.png',
      ]);
    },
  );

  test('ignores scripts, local URLs, tracking pixels and hidden images', () {
    final result = ShareCardContent.fromHtml(
      baseUrl: Uri.parse('https://example.com/'),
      html:
          '<script>secret()</script><style>.x{}</style><p>正文</p>'
          '<img src="file:///private/image.jpg">'
          '<img src="javascript:bad()">'
          '<img width="1" height="1" src="/pixel.gif">'
          '<img hidden src="/hidden.jpg"><img src="/real.jpg">',
    );
    expect(result.excerpt, '正文');
    expect(result.images, [Uri.parse('https://example.com/real.jpg')]);
  });

  test('text-only and missing content work without a cover', () {
    final result = ShareCardContent.fromHtml(html: null);
    expect(result.excerpt, isEmpty);
    expect(result.images, isEmpty);
  });

  test('bounds candidates and truncates text without splitting Unicode', () {
    final result = ShareCardContent.fromHtml(
      baseUrl: Uri.parse('https://example.com/'),
      html:
          '<p>${'🌍' * 601}</p>'
          '${List.generate(20, (i) => '<img src="/$i.jpg">').join()}',
    );
    expect(result.images.length, 3);
    expect(result.excerpt, '${'🌍' * 600}…');
  });
}
