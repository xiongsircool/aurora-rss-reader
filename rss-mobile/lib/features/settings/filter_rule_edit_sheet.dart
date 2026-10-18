import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';

import '../../data/database/local_database.dart';
import '../../domain/filtering/filter_matcher.dart';
import '../../l10n/generated/app_localizations.dart';
import '../reader/mobile_reader_controller.dart';

/// Bottom sheet for creating or editing one filter rule. Saving applies
/// the rule to existing articles immediately (progress-free: usually a
/// fast local pass) and reports how many were affected.
Future<void> showFilterRuleEditSheet(
  BuildContext context, {
  required MobileReaderController controller,
  FilterRuleRow? existing,
  String? initialFeedId,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => _FilterRuleSheet(
      controller: controller,
      existing: existing,
      initialFeedId: initialFeedId,
    ),
  );
}

final class _FilterRuleSheet extends StatefulWidget {
  const _FilterRuleSheet({
    required this.controller,
    this.existing,
    this.initialFeedId,
  });

  final MobileReaderController controller;
  final FilterRuleRow? existing;
  final String? initialFeedId;

  @override
  State<_FilterRuleSheet> createState() => _FilterRuleSheetState();
}

class _FilterRuleSheetState extends State<_FilterRuleSheet> {
  late final TextEditingController _pattern;
  late bool _isRegex;
  late FilterMatchField _field;
  late FilterAction _action;
  late String? _feedId; // null = all feeds
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final existing = widget.existing;
    _pattern = TextEditingController(
      text: existing?.pattern ?? (widget.initialFeedId == null ? '' : ''),
    );
    _isRegex = existing?.isRegex ?? false;
    _field =
        existing == null
            ? FilterMatchField.title
            : filterMatchFieldFromString(existing.matchField);
    _action =
        existing == null
            ? FilterAction.hide
            : filterActionFromString(existing.action);
    _feedId = existing?.feedId ?? widget.initialFeedId;
  }

  @override
  void dispose() {
    _pattern.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final pattern = _pattern.text.trim();
    if (pattern.isEmpty) return;
    final l = AppLocalizations.of(context)!;
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    setState(() => _saving = true);
    final now = DateTime.now().toUtc();
    await widget.controller.repository.saveFilterRule(
      FilterRulesCompanion.insert(
        id: widget.existing?.id ?? 'rule-${now.microsecondsSinceEpoch}',
        pattern: pattern,
        isRegex: Value(_isRegex),
        matchField: Value(_field.name),
        action: Value(_action.name),
        feedId: Value(_feedId),
        createdAt: widget.existing?.createdAt ?? now,
        updatedAt: now,
      ),
    );
    final affected = await widget.controller.repository
        .applyFilterRulesToExisting();
    await widget.controller.reloadTags();
    navigator.pop();
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          affected > 0 ? l.filterRuleApplied(affected) : l.filterRuleAppliedZero,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final feeds = widget.controller.feeds;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        4,
        20,
        20 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            widget.existing == null ? l.filterRuleNew : l.filterRuleEdit,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _pattern,
            autofocus: widget.existing == null,
            decoration: InputDecoration(
              labelText: l.filterRulePattern,
              hintText: _isRegex ? r'(?i)gpt-?5' : l.filterRulePatternHint,
              border: const OutlineInputBorder(),
            ),
            onSubmitted: (_) => _save(),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(l.filterRuleIsRegex),
            value: _isRegex,
            onChanged: (v) => setState(() => _isRegex = v),
          ),
          Text(l.filterRuleFieldLabel, style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 6),
          SegmentedButton<FilterMatchField>(
            segments: [
              ButtonSegment(value: FilterMatchField.title, label: Text(l.filterRuleFieldTitle)),
              ButtonSegment(
                value: FilterMatchField.titleAndSummary,
                label: Text(l.filterRuleFieldTitleSummary),
              ),
            ],
            selected: {_field},
            onSelectionChanged: (s) => setState(() => _field = s.first),
          ),
          const SizedBox(height: 14),
          Text(l.filterRuleActionLabel, style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 6),
          SegmentedButton<FilterAction>(
            segments: [
              ButtonSegment(value: FilterAction.hide, label: Text(l.filterActionHide)),
              ButtonSegment(value: FilterAction.markRead, label: Text(l.filterActionMarkRead)),
              ButtonSegment(value: FilterAction.star, label: Text(l.filterActionStar)),
            ],
            selected: {_action},
            onSelectionChanged: (s) => setState(() => _action = s.first),
          ),
          const SizedBox(height: 6),
          Text(
            switch (_action) {
              FilterAction.hide => l.filterActionHideDesc,
              FilterAction.markRead => l.filterActionMarkReadDesc,
              FilterAction.star => l.filterActionStarDesc,
            },
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 14),
          Text(l.filterRuleScopeLabel, style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 6),
          SegmentedButton<bool>(
            segments: [
              ButtonSegment(value: false, label: Text(l.filterRuleScopeAll)),
              ButtonSegment(value: true, label: Text(l.filterRuleScopeFeed)),
            ],
            selected: {_feedId != null},
            onSelectionChanged: (s) => setState(
              () => _feedId = s.first ? _feedId ?? feeds.first.id : null,
            ),
          ),
          if (_feedId != null && feeds.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: DropdownMenu<String>(
                width: double.infinity,
                initialSelection: _feedId,
                label: Text(l.filterRulePickFeed),
                dropdownMenuEntries: [
                  for (final feed in feeds)
                    DropdownMenuEntry(value: feed.id, label: feed.title),
                ],
                onSelected: (id) => setState(() => _feedId = id),
              ),
            ),
          const SizedBox(height: 18),
          FilledButton(
            onPressed: _saving || _pattern.text.trim().isEmpty
                ? null
                : _save,
            child: Text(l.save),
          ),
        ],
      ),
    );
  }
}
