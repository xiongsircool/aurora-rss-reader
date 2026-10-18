import 'package:aurora_mobile/domain/filtering/filter_matcher.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  CompiledFilterRule rule(
    String pattern, {
    bool isRegex = false,
    String matchField = 'title',
    String action = 'hide',
    String? feedId,
    bool enabled = true,
  }) {
    return CompiledFilterRule.fromValues(
      id: 'r-$pattern',
      pattern: pattern,
      isRegex: isRegex,
      matchField: matchField,
      action: action,
      feedId: feedId,
      enabled: enabled,
    );
  }

  group('CompiledFilterRule', () {
    test('keyword list split by |, case-insensitive, CJK substring', () {
      final r = rule('好物推荐|SALE|优惠券');
      expect(r.matches(title: '双11好物推荐来了', summary: null, feedId: 'f1'), isTrue);
      expect(r.matches(title: 'Big sale today', summary: null, feedId: 'f1'), isTrue);
      expect(r.matches(title: '正常文章', summary: null, feedId: 'f1'), isFalse);
    });

    test('ascii keywords respect word boundaries', () {
      final r = rule('ai');
      expect(r.matches(title: 'The state of AI', summary: null, feedId: 'f'), isTrue);
      expect(r.matches(title: 'Daily email digest', summary: null, feedId: 'f'), isFalse);
    });

    test('regex mode with case-insensitive flag from settings', () {
      final r = rule(r'gpt-?5', isRegex: true);
      expect(r.matches(title: 'Introducing GPT5', summary: null, feedId: 'f'), isTrue);
      expect(r.matches(title: 'GPT-5 pricing', summary: null, feedId: 'f'), isTrue);
      expect(r.matches(title: 'Claude 4', summary: null, feedId: 'f'), isFalse);
    });

    test('invalid regex is inert, never throws', () {
      final r = rule('([unclosed', isRegex: true);
      expect(r.matches(title: 'anything', summary: null, feedId: 'f'), isFalse);
    });

    test('summary is only searched in titleAndSummary mode', () {
      final r = rule('coupon');
      expect(
        r.matches(title: 'Nice deal', summary: 'use coupon X', feedId: 'f'),
        isFalse,
      );
      final wide = rule('coupon', matchField: 'titleAndSummary');
      expect(
        wide.matches(title: 'Nice deal', summary: 'use coupon X', feedId: 'f'),
        isTrue,
      );
    });

    test('feed scope restricts matching; null feedId applies everywhere', () {
      final scoped = rule('spam', feedId: 'f2');
      expect(scoped.matches(title: 'spam here', summary: null, feedId: 'f1'), isFalse);
      expect(scoped.matches(title: 'spam here', summary: null, feedId: 'f2'), isTrue);
      final global = rule('spam');
      expect(global.matches(title: 'spam here', summary: null, feedId: 'any'), isTrue);
    });

    test('disabled rules never match', () {
      final r = rule('spam', enabled: false);
      expect(r.matches(title: 'spam', summary: null, feedId: 'f'), isFalse);
    });
  });

  group('evaluateFilterRules', () {
    test('hide dominates markRead and star', () {
      final verdict = evaluateFilterRules(
        [
          rule('promo', action: 'markRead'),
          rule('promo', action: 'star'),
          rule('promo', action: 'hide'),
        ],
        title: 'promo post',
        summary: null,
        feedId: 'f',
      );
      expect(verdict.hide, isTrue);
      expect(verdict.markRead, isFalse);
      expect(verdict.star, isFalse);
      expect(verdict.matchedRuleIds, hasLength(3));
    });

    test('no match yields a no-op verdict', () {
      final verdict = evaluateFilterRules(
        [rule('promo')],
        title: 'regular article',
        summary: null,
        feedId: 'f',
      );
      expect(verdict.hasAction, isFalse);
      expect(verdict.hide, isFalse);
    });
  });
}
