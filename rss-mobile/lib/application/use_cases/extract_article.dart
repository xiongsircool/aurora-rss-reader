import 'package:reader_mode/reader_mode.dart' as readability;

import '../../domain/feed_parsing/feed_encoding.dart';
import '../ports/feed_http_client.dart';

final class ExtractedArticle {
  const ExtractedArticle({
    required this.title,
    required this.contentHtml,
    required this.textContent,
    required this.sourceUrl,
    this.byline,
    this.excerpt,
    this.siteName,
    this.language,
  });

  final String title;
  final String contentHtml;
  final String textContent;
  final Uri sourceUrl;
  final String? byline;
  final String? excerpt;
  final String? siteName;
  final String? language;
}

final class ArticleExtractionException implements Exception {
  const ArticleExtractionException(this.message);

  final String message;

  @override
  String toString() => 'ArticleExtractionException: $message';
}

final class ExtractArticle {
  const ExtractArticle({required this.httpClient});

  final FeedHttpClient httpClient;

  Future<ExtractedArticle> call(Uri url) async {
    if (url.scheme != 'http' && url.scheme != 'https') {
      throw const ArticleExtractionException('仅支持 HTTP/HTTPS 页面');
    }

    final response = await httpClient.get(
      url,
      timeout: const Duration(seconds: 25),
      maxBytes: 8 * 1024 * 1024,
      accept: 'text/html, application/xhtml+xml;q=0.9, */*;q=0.5',
    );
    final contentType = response.header('content-type');
    if (contentType != null &&
        !contentType.toLowerCase().contains('html') &&
        !contentType.toLowerCase().startsWith('text/')) {
      throw ArticleExtractionException('页面不是 HTML：$contentType');
    }

    final html = decodeHtmlBytes(response.body, contentType: contentType);
    final article = readability.parse(
      html,
      baseUri: response.finalUri.toString(),
      charThreshold: 120,
    );
    if (article == null ||
        article.content.trim().isEmpty ||
        article.textContent.trim().length < 80) {
      throw const ArticleExtractionException('无法识别网页正文');
    }

    return ExtractedArticle(
      title: article.title.trim(),
      contentHtml: article.content.trim(),
      textContent: article.textContent.trim(),
      sourceUrl: response.finalUri,
      byline: article.byline?.trim(),
      excerpt: article.excerpt?.trim().isEmpty == false
          ? article.excerpt!.trim()
          : null,
      siteName: article.siteName?.trim(),
      language: article.lang?.trim(),
    );
  }
}
