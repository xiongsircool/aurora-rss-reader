import 'package:flutter/material.dart';

import '../../data/database/local_database.dart';
import '../../domain/filtering/filter_matcher.dart';
import '../../l10n/generated/app_localizations.dart';
import '../reader/mobile_reader_controller.dart';
import 'filter_rule_edit_sheet.dart';

/// Settings page listing every filter rule: toggle, edit, delete.
/// Rules also run on every refresh before entries reach the inbox.
final class FilterRulesPage extends StatefulWidget {
  const FilterRulesPage({super.key, required this.controller});

  final MobileReaderController controller;

  @override
  State<FilterRulesPage> createState() => _FilterRulesPageState();
}

class _FilterRulesPageState extends State<FilterRulesPage> {
  List<FilterRuleRow> _rules = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final rules = await widget.controller.repository.listFilterRules();
    if (!mounted) return;
    setState(() {
      _rules = rules;
      _loading = false;
    });
  }

  Future<void> _delete(FilterRuleRow rule) async {
    final l = AppLocalizations.of(context)!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l.filterRuleDelete),
        content: Text(l.filterRuleDeleteBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(l.cancel),
          ),
          FilledButton.tonal(
            style: FilledButton.styleFrom(
              foregroundColor: Theme.of(dialogContext).colorScheme.error,
            ),
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(l.delete),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await widget.controller.repository.deleteFilterRule(rule.id);
    await _load();
  }

  Future<void> _openEditor({FilterRuleRow? existing}) async {
    await showFilterRuleEditSheet(
      context,
      controller: widget.controller,
      existing: existing,
    );
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        title: Text(l.filterRules),
        actions: [
          IconButton(
            tooltip: l.filterRuleNew,
            icon: const Icon(Icons.add),
            onPressed: () => _openEditor(),
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: SizedBox.square(
                dimension: 22,
                child: CircularProgressIndicator(strokeWidth: 2.2),
              ),
            )
          : _rules.isEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.filter_alt_off_outlined,
                      size: 44,
                      color: scheme.onSurfaceVariant,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      l.filterRulesEmpty,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: scheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 14),
                    FilledButton.tonalIcon(
                      onPressed: () => _openEditor(),
                      icon: const Icon(Icons.add),
                      label: Text(l.filterRuleNew),
                    ),
                  ],
                ),
              ),
            )
          : ListView.separated(
              itemCount: _rules.length,
              separatorBuilder: (_, _) => Divider(
                height: 1,
                color: scheme.outlineVariant.withValues(alpha: 0.35),
              ),
              itemBuilder: (context, index) {
                final rule = _rules[index];
                final action = filterActionFromString(rule.action);
                final field = filterMatchFieldFromString(rule.matchField);
                final feedName =
                    rule.feedId == null
                        ? l.filterRuleScopeAll
                        : widget.controller.feedTitle(rule.feedId!);
                return ListTile(
                  leading: Icon(
                    switch (action) {
                      FilterAction.hide => Icons.block_rounded,
                      FilterAction.markRead => Icons.done_all_rounded,
                      FilterAction.star => Icons.star_rounded,
                    },
                    color: action == FilterAction.hide
                        ? scheme.error
                        : action == FilterAction.star
                        ? const Color(0xFFF4A000)
                        : scheme.primary,
                  ),
                  title: Text(
                    rule.pattern,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontFamily: 'monospace'),
                  ),
                  subtitle: Text(
                    '${action.name == 'hide'
                        ? l.filterActionHide
                        : action.name == 'markRead'
                        ? l.filterActionMarkRead
                        : l.filterActionStar} · $feedName · '
                    '${field == FilterMatchField.title
                        ? l.filterRuleFieldTitle
                        : l.filterRuleFieldTitleSummary}'
                    '${rule.hitCount > 0 ? ' · ${l.filterRuleHits(rule.hitCount)}' : ''}'
                    '${rule.isRegex ? ' · regex' : ''}',
                  ),
                  trailing: Switch(
                    value: rule.enabled,
                    onChanged: (enabled) async {
                      await widget.controller.repository
                          .setFilterRuleEnabled(rule.id, enabled);
                      await _load();
                    },
                  ),
                  onTap: () => _openEditor(existing: rule),
                  onLongPress: () => _delete(rule),
                );
              },
            ),
    );
  }
}
