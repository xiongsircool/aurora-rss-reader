import 'package:aurora_mobile/domain/tts/sentence_splitter.dart';
import 'package:aurora_mobile/features/audio/tts_controller.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('splitIntoSentences', () {
    test('splits on CJK terminators without spaces', () {
      final s = splitIntoSentences('<p>今天天气很好。我们去公园吧！真的吗？</p>');
      expect(s, ['今天天气很好。', '我们去公园吧！', '真的吗？']);
    });

    test('decimals never split', () {
      final s = splitIntoSentences('Version 3.5 shipped today. Users rejoice.');
      expect(s.length, 2);
      expect(s.first, contains('3.5'));
    });

    test('common abbreviations never split', () {
      final s = splitIntoSentences(
        'Use tools, e.g. hammers. Also i.e. means that. Fine.',
      );
      expect(s.first, contains('e.g.'));
      expect(s.any((x) => x.startsWith('Also')), isTrue);
    });

    test('strips code blocks, tables and figures entirely', () {
      final s = splitIntoSentences(
        'Before code. <pre>int main() { return 0; }</pre>'
        '<table><tr><td>cell 1.1</td></tr></table>'
        '<figure><img src="x"/><figcaption>pic. caption</figcaption></figure>'
        'After code.',
      );
      expect(s, ['Before code.', 'After code.']);
    });

    test('merges only unterminated short leftovers', () {
      // Explicit terminators win: short CJK sentences stay standalone.
      final s = splitIntoSentences('好。这是第二句比较长一些的内容啊。');
      expect(s.length, 2);
      // An unterminated tiny leftover merges into its neighbour.
      final merged = splitIntoSentences('Done reading. 真棒');
      expect(merged, hasLength(1));
      expect(merged.single, contains('真棒'));
    });

    test('hard-splits sentences beyond the length cap', () {
      final long = '字' * (kMaxSentenceLength + 80);
      final s = splitIntoSentences(long);
      expect(s, isNotEmpty);
      for (final sentence in s) {
        expect(sentence.length, lessThanOrEqualTo(kMaxSentenceLength + 40));
      }
      // Content is preserved (minus separators).
      expect(s.join('').replaceAll(' ', '').length, greaterThan(200));
    });

    test('paragraph breaks become sentence boundaries', () {
      final s = splitIntoSentences('第一段结束\n\n第二段开始');
      expect(s.length, 2);
    });

    test('empty and null inputs are safe', () {
      expect(splitIntoSentences(null), isEmpty);
      expect(splitIntoSentences(''), isEmpty);
      expect(splitIntoSentences('<pre>only code</pre>'), isEmpty);
    });
  });

  group('TtsController.speechRateFor', () {
    test('iOS maps 1x to the 0.5 default and caps at 1.0', () {
      expect(TtsController.speechRateFor('ios', 1), 0.5);
      expect(TtsController.speechRateFor('ios', 2), 1.0);
      expect(TtsController.speechRateFor('ios', 0.75), closeTo(0.375, 0.001));
    });

    test('Android passes the user speed through, clamped', () {
      expect(TtsController.speechRateFor('android', 1), 1);
      expect(TtsController.speechRateFor('android', 2), 2);
      expect(TtsController.speechRateFor('android', 3), 2);
    });
  });
}
