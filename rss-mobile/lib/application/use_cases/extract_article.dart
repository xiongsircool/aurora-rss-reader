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
      // Many sites reject unknown user agents outright with 403/challenge
      // pages, so article extraction presents itself as a mobile browser.
      userAgent:
          'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 '
          '(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    );
    final contentType = response.header('content-type');
    if (contentType != null &&
        !contentType.toLowerCase().contains('html') &&
        !contentType.toLowerCase().startsWith('text/')) {
      throw ArticleExtractionException('页面不是 HTML：$contentType');
    }
    // Anti-bot layers (e.g. Ars Technica) answer non-JS clients with an
    // empty 202 body. Surface that as a clear, actionable error instead
    // of a confusing "no content extracted" failure.
    if (response.statusCode != 200) {
      throw ArticleExtractionException(
        '该网站启用了反爬保护（HTTP ${response.statusCode}），无法提取正文',
      );
    }
    if (response.body.length < 64) {
      throw const ArticleExtractionException('页面没有返回任何内容');
    }

    final html = decodeHtmlBytes(response.body, contentType: contentType);
    // The jsdom port trips on malformed real-world markup; the pure-Dart
    // html package handles it and is the reliable primary here.
    var article = readability.parse(
      html,
      parser: readability.ParserType.html,
      baseUri: response.finalUri.toString(),
      charThreshold: 120,
    );
    article ??= readability.parse(
      html,
      parser: readability.ParserType.jsdom,
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
