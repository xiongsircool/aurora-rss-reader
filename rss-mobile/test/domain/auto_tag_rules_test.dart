import 'package:aurora_mobile/domain/tagging/auto_tag_rules.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('matchAutoTags', () {
    test('matches Chinese keywords in the title', () {
      final tags = matchAutoTags(title: 'OpenAI 发布新一代大模型', summary: null);
      expect(tags, containsAll(<String>['AI']));
      expect(tags.length, lessThanOrEqualTo(kMaxAutoTagsPerEntry));
    });

    test('matches English keywords on word boundaries only', () {
      // "email" must not trigger the AI category ("ai" substring).
      expect(matchAutoTags(title: 'Daily email digest', summary: null), isEmpty);
      // Standalone "ai" does.
      expect(matchAutoTags(title: 'The state of AI in 2026', summary: null),
          contains('AI'));
    });

    test('strips HTML before matching', () {
      final tags = matchAutoTags(
        title: 'Weekly digest',
        summary: '<p>本期聊聊<b>深度学习</b>与框架选择</p>',
      );
      expect(tags, contains('AI'));
    });

    test('DOI forces 科研; PMID forces 科研 and 生物', () {
      expect(
        matchAutoTags(title: 'Perspective', summary: null, doi: '10.1038/s41586-026-01234-5'),
        contains('科研'),
      );
      expect(
        matchAutoTags(title: 'Abstract', summary: null, pmid: '39000000'),
        containsAll(<String>['科研', '生物']),
      );
    });

    test('caps results at three tags, best score first', () {
      final tags = matchAutoTags(
        title: 'GPT-5 发布会：芯片、芯片与更多芯片',
        summary: '人工智能 ai llm gpt 基因 dna 细胞 电影 音乐',
      );
      expect(tags.length, kMaxAutoTagsPerEntry);
      expect(tags.first, anyOf('科技', 'AI'));
    });

    test('returns empty for unrelated text', () {
      expect(
          matchAutoTags(title: '碎碎念：星期三，无事发生', summary: '出门走了走'),
          isEmpty);
    });

    test('catalog covers the agreed broad categories', () {
      final names = autoTagCatalog.map((c) => c.name).toSet();
      expect(names, containsAll(<String>['科技', 'AI', '编程', '科研', '生物']));
      // All names unique, all keywords lowercase.
      expect(names.length, autoTagCatalog.length);
      for (final category in autoTagCatalog) {
        for (final keyword in category.keywords) {
          expect(keyword, keyword.toLowerCase(),
              reason: '${category.name}: $keyword must be lowercase');
        }
      }
    });
  });
}
