// ignore_for_file: avoid_print
import 'dart:io';

import 'package:aurora_mobile/application/use_cases/extract_article.dart';
import 'package:aurora_mobile/platform/http/io_feed_http_client.dart';

void main(List<String> args) async {
  final urls = args.isNotEmpty
      ? args
      : ['https://sspai.com/post/113990', 'https://sspai.com/post/114110'];
  final client = IoFeedHttpClient();
  final extract = ExtractArticle(httpClient: client);
  for (final raw in urls) {
    final url = Uri.parse(raw);
    try {
      final article = await extract.call(url);
      final imgCount = RegExp('<img').allMatches(article.contentHtml).length;
      print('OK $url');
      print('  title=${article.title}');
      print('  textLen=${article.textContent.length} imgTags=$imgCount');
    } catch (error) {
      print('FAIL $url');
      print('  $error');
    }
  }
  client.close();
  exit(0);
}
