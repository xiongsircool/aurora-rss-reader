import 'package:aurora_mobile/features/reader/article_reader_page.dart';
import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('adds Referer header to network article images', () {
    const referer = 'https://sspai.com/post/113990';
    final factory = ArticleWidgetFactory(referer: referer);

    final provider = factory.imageProviderFromNetwork(
      'https://cdnfile.sspai.com/pic.png',
    );

    expect(provider, isA<NetworkImage>());
    final networkImage = provider! as NetworkImage;
    expect(networkImage.url, 'https://cdnfile.sspai.com/pic.png');
    expect(networkImage.headers?['Referer'], referer);
  });

  test('omits headers when no Referer is configured', () {
    final factory = ArticleWidgetFactory();

    final provider = factory.imageProviderFromNetwork(
      'https://cdn.example.com/pic.png',
    );

    expect(provider, isA<NetworkImage>());
    final networkImage = provider! as NetworkImage;
    expect(networkImage.headers, isNull);
  });
}
