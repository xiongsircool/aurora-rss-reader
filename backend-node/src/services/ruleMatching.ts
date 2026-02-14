/**
 * Rule-Based Tag Matching Engine
 * Matches entries against tag rules using keyword AND/OR/NOT logic.
 * Runs synchronously — no AI cost, instant results.
 */

import { UserTag, TagMatchRule } from '../db/models.js';

export interface RuleMatchContent {
  title: string;
  summary?: string | null;
}

/**
 * Parse the match_rules JSON string from a tag into TagMatchRule[].
 * Returns empty array on invalid/missing input.
 */
export function parseMatchRules(rulesJson: string | null): TagMatchRule[] {
  if (!rulesJson) return [];
  try {
    const parsed = JSON.parse(rulesJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r: any) =>
        r &&
        Array.isArray(r.keywords) &&
        r.keywords.length > 0 &&
        (r.operator === 'AND' || r.operator === 'OR')
    );
  } catch {
    return [];
  }
}

/**
 * Test whether a single rule group matches the given text.
 * - Keywords are matched case-insensitively as substrings.
 * - `operator` controls how keywords relate: AND = all must match, OR = any must match.
 * - `exclude` keywords: if ANY exclude keyword is found, the group does NOT match.
 */
function matchRuleGroup(text: string, rule: TagMatchRule): boolean {
  const lowerText = text.toLowerCase();

  // Check exclusions first — any exclude hit means no match
  if (rule.exclude && rule.exclude.length > 0) {
    for (const ex of rule.exclude) {
      if (ex && lowerText.includes(ex.toLowerCase())) {
        return false;
      }
    }
  }

  // Check keywords
  if (rule.operator === 'AND') {
    return rule.keywords.every((kw) => kw && lowerText.includes(kw.toLowerCase()));
  } else {
    // OR
    return rule.keywords.some((kw) => kw && lowerText.includes(kw.toLowerCase()));
  }
}

/**
 * Check if an entry matches a tag's rules.
 * Multiple rule groups are OR'd together (any group match = overall match).
 * Matching is performed against the concatenation of title + summary.
 */
export function matchEntryByRules(
  content: RuleMatchContent,
  tag: UserTag
): boolean {
  const rules = parseMatchRules(tag.match_rules);
  if (rules.length === 0) return false;

  // Build searchable text from title + summary
  const parts: string[] = [];
  if (content.title) parts.push(content.title);
  if (content.summary) parts.push(content.summary);
  const text = parts.join(' ');
  if (!text.trim()) return false;

  // Any rule group matching = overall match (groups are OR'd)
  return rules.some((rule) => matchRuleGroup(text, rule));
}

/**
 * Run rule matching for an entry against all rule-enabled tags.
 * Returns the IDs of tags that matched.
 */
export function runRuleMatchingForEntry(
  content: RuleMatchContent,
  ruleTags: UserTag[]
): string[] {
  const matchedIds: string[] = [];
  for (const tag of ruleTags) {
    if (matchEntryByRules(content, tag)) {
      matchedIds.push(tag.id);
    }
  }
  return matchedIds;
}
