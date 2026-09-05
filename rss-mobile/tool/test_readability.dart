import 'dart:io';

// ignore_for_file: avoid_print
import 'package:html/parser.dart' as html_parser;
import 'package:reader_mode/reader_mode.dart' as readability;

void main(List<String> args) {
  final html = File(args.first).readAsStringSync();
  final doc = html_parser.parse(html);
  print('probablyReadable=${readability.isProbablyReaderable(doc)}');

  for (final parser in [
    readability.ParserType.jsdom,
    readability.ParserType.html,
  ]) {
    final watch = Stopwatch()..start();
    final article = readability.parse(
      html,
      parser: parser,
      baseUri: 'https://sspai.com',
      charThreshold: 120,
    );
    watch.stop();
    print(
      '${parser.name}: ${watch.elapsedMilliseconds}ms '
      'null=${article == null} '
      'title=${article?.title} '
      'contentLen=${article?.content.length} '
      'textLen=${article?.textContent.trim().length}',
    );
  }
}
