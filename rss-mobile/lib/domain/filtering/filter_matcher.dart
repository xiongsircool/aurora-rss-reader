/// Feed filter rules: match incoming entries against user-defined
/// keyword lists (separated by `|`) or regexes, then act on them
/// (hide / mark read / star).
///
/// Matching mirrors the auto-tag strategy: ASCII keywords match on
/// word boundaries (so "ai" never fires inside "email"); CJK keywords
/// match by substring; everything is case-insensitive. Invalid regex
/// patterns simply never match instead of crashing a refresh.
library;

enum FilterAction { hide, markRead, star }

enum FilterMatchField { title, titleAndSummary }

FilterAction filterActionFromString(String value) {
  return FilterAction.values.firstWhere(
    (action) => action.name == value,
    orElse: () => FilterAction.hide,
  );
}

FilterMatchField filterMatchFieldFromString(String value) {
  return value == 'titleAndSummary'
      ? FilterMatchField.titleAndSummary
      : FilterMatchField.title;
}

/// A compiled, ready-to-evaluate rule.
final class CompiledFilterRule {
  CompiledFilterRule({
    required this.id,
    required this.action,
    required this.matchField,
    required this.feedId,
    required this.enabled,
    required this.patterns,
    required this.substrings,
  });

  final String id;
  final FilterAction action;
  final FilterMatchField matchField;
  final String? feedId; // null = all feeds
  final bool enabled;

  final List<RegExp> patterns;
  final List<String> substrings;

  /// Compiles a rule from raw storage values. Pattern is either a
  /// `|`-separated keyword list or (when [isRegex]) a single regex.
  factory CompiledFilterRule.fromValues({
    required String id,
    required String pattern,
    required bool isRegex,
    required String matchField,
    required String action,
    String? feedId,
    required bool enabled,
  }) {
    final patterns = <RegExp>[];
    final substrings = <String>[];
    if (isRegex) {
      try {
        patterns.add(RegExp(pattern, caseSensitive: false));
      } catch (_) {
        // Invalid regex: rule is inert but keeps editing in the UI.
      }
    } else {
      for (final keyword in pattern.split('|')) {
        final kw = keyword.trim().toLowerCase();
        if (kw.isEmpty) continue;
        if (RegExp(r'^[a-z0-9 .\-]+$').hasMatch(kw)) {
          patterns.add(RegExp('\\b${kw.replaceAll('/', '\\/')}\\b'));
        } else {
          substrings.add(kw);
        }
      }
    }
    return CompiledFilterRule(
      id: id,
      action: filterActionFromString(action),
      matchField: filterMatchFieldFromString(matchField),
      feedId: feedId,
      enabled: enabled,
      patterns: patterns,
      substrings: substrings,
    );
  }

  bool appliesToFeed(String feedId) => this.feedId == null || this.feedId == feedId;

  bool matches({required String title, String? summary, required String feedId}) {
    if (!enabled || !appliesToFeed(feedId)) return false;
    final sources = <String>[
      if (matchField == FilterMatchField.title || summary == null)
        title.toLowerCase(),
      if (matchField == FilterMatchField.titleAndSummary && summary != null)
        summary.toLowerCase(),
    ];
    for (final source in sources) {
      for (final pattern in patterns) {
        if (pattern.hasMatch(source)) return true;
      }
      for (final keyword in substrings) {
        if (source.contains(keyword)) return true;
      }
    }
    return false;
  }
}

/// The set of actions to apply to one entry. `hide` dominates: hidden
/// entries are never inserted, so other actions become moot.
final class FilterVerdict {
  const FilterVerdict({required this.hide, required this.markRead, required this.star, required this.matchedRuleIds});

  final bool hide;
  final bool markRead;
  final bool star;
  final List<String> matchedRuleIds;

  bool get hasAction => hide || markRead || star || matchedRuleIds.isNotEmpty;
}

/// Evaluates [rules] against one entry. Returns a no-op verdict when
/// nothing matches.
FilterVerdict evaluateFilterRules(
  List<CompiledFilterRule> rules, {
  required String title,
  String? summary,
  required String feedId,
}) {
  var hide = false;
  var markRead = false;
  var star = false;
  final matched = <String>[];
  for (final rule in rules) {
    if (!rule.matches(title: title, summary: summary, feedId: feedId)) {
      continue;
    }
    matched.add(rule.id);
    switch (rule.action) {
      case FilterAction.hide:
        hide = true;
      case FilterAction.markRead:
        markRead = true;
      case FilterAction.star:
        star = true;
    }
  }
  return FilterVerdict(
    hide: hide,
    markRead: markRead && !hide,
    star: star && !hide,
    matchedRuleIds: matched,
  );
}
