import 'package:flutter/material.dart';

import '../../data/repositories/local_content_repository.dart'
    show TagSummary;
import '../reader/mobile_reader_controller.dart';
import '../../l10n/generated/app_localizations.dart';

/// Tag picker sheet: toggles existing tags on an entry and creates
/// new ones inline. New tags are assigned to the entry immediately.
Future<void> showTagPickerSheet(
  BuildContext context, {
  required MobileReaderController controller,
  required String entryId,
}) {
  return showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (_) => _TagPickerSheet(controller: controller, entryId: entryId),
  );
}

final class _TagPickerSheet extends StatefulWidget {
  const _TagPickerSheet({required this.controller, required this.entryId});

  final MobileReaderController controller;
  final String entryId;

  @override
  State<_TagPickerSheet> createState() => _TagPickerSheetState();
}

class _TagPickerSheetState extends State<_TagPickerSheet> {
  Map<String, bool> _assigned = <String, bool>{};
  String _filter = '';
  bool _loading = true;
  final TextEditingController _newTagController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadSelection();
  }

  @override
  void dispose() {
    _newTagController.dispose();
    super.dispose();
  }

  Future<void> _loadSelection() async {
    final details = await widget.controller.repository.entryTagDetails(
      widget.entryId,
    );
    if (!mounted) return;
    setState(() {
      _assigned = details;
      _loading = false;
    });
  }

  Future<void> _toggle(TagSummary tag, bool assigned) async {
    setState(() {
      assigned ? _assigned[tag.id] = true : _assigned.remove(tag.id);
    });
    await widget.controller.setEntryTag(
      entryId: widget.entryId,
      tagId: tag.id,
      assigned: assigned,
    );
  }

  Future<void> _createAndAssign() async {
    final name = _newTagController.text.trim();
    if (name.isEmpty) return;
    _newTagController.clear();
    try {
      final tag = await widget.controller.createTag(name);
      if (!mounted) return;
      await _toggle(tag, true);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('创建标签失败：$error')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l.tagPickerTitle,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 12),
          TextField(
            onChanged: (value) => setState(() => _filter = value.trim()),
            decoration: InputDecoration(
              hintText: l.tagFilterHint,
              prefixIcon: const Icon(Icons.search, size: 20),
              isDense: true,
              border: const OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          Flexible(
            child: _loading
                ? const Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(
                      child: SizedBox.square(
                        dimension: 22,
                        child: CircularProgressIndicator(strokeWidth: 2.2),
                      ),
                    ),
                  )
                : _buildChips(context, scheme),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _newTagController,
                  onSubmitted: (_) => _createAndAssign(),
                  textInputAction: TextInputAction.done,
                  decoration: InputDecoration(
                    hintText: l.tagNewNameHint,
                    isDense: true,
                    border: const OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton.tonal(
                onPressed: _createAndAssign,
                child: Text(l.tagCreate),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildChips(BuildContext context, ColorScheme scheme) {
    final l = AppLocalizations.of(context)!;
    final tags = widget.controller.tags
        .where(
          (tag) =>
              _filter.isEmpty ||
              tag.name.toLowerCase().contains(_filter.toLowerCase()),
        )
        .toList();
    if (tags.isEmpty && _filter.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 20),
        child: Center(
          child: Text(
            l.tagPickerEmpty,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: scheme.onSurfaceVariant,
            ),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }
    return SingleChildScrollView(
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final tag in tags)
            FilterChip(
              selected: _assigned.containsKey(tag.id),
              onSelected: (value) => _toggle(tag, value),
              label: Text(tag.name),
              avatar: _assigned.containsKey(tag.id) && _assigned[tag.id] == false
                  ? Icon(
                      Icons.auto_awesome,
                      size: 12,
                      color: _parseColor(tag.color),
                    )
                  : _assigned.containsKey(tag.id)
                  ? null
                  : Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: _parseColor(tag.color),
                        shape: BoxShape.circle,
                      ),
                    ),
            ),
        ],
      ),
    );
  }
}

Color _parseColor(String hex) {
  final value = int.tryParse(hex.replaceFirst('#', ''), radix: 16);
  if (value == null) return const Color(0xFF3B82F6);
  return Color(0xFF000000 | value);
}

/// Re-exported for sibling widgets that render tag color dots.
Color tagDotColor(String hex) => _parseColor(hex);
