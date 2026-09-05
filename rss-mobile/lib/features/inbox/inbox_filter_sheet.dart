import 'package:flutter/material.dart';

import '../reader/mobile_reader_controller.dart';
import '../sources/group_picker.dart' show groupDisplayName;

/// Inbox filter sheet: read-state toggle plus per-group visibility.
/// Muted groups disappear from the inbox until re-enabled.
Future<void> showInboxFilterSheet(
  BuildContext context,
  MobileReaderController controller,
) {
  return showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => _InboxFilterSheet(controller: controller),
  );
}

final class _InboxFilterSheet extends StatefulWidget {
  const _InboxFilterSheet({required this.controller});

  final MobileReaderController controller;

  @override
  State<_InboxFilterSheet> createState() => _InboxFilterSheetState();
}

class _InboxFilterSheetState extends State<_InboxFilterSheet> {
  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.controller,
      builder: (context, _) {
        final groups = widget.controller.groups;
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                '筛选',
                style: Theme.of(context).textTheme.titleLarge
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              SegmentedButton<int>(
                segments: const [
                  ButtonSegment(value: 0, label: Text('全部文章')),
                  ButtonSegment(value: 1, label: Text('仅未读')),
                ],
                selected: {widget.controller.unreadOnly ? 1 : 0},
                onSelectionChanged: (selection) {
                  widget.controller.setUnreadOnly(selection.single == 1);
                },
              ),
              const SizedBox(height: 12),
              Text(
                '显示的分组',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 4),
              if (groups.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Text('暂无分组'),
                )
              else
                for (final group in groups)
                  SwitchListTile(
                    key: ValueKey('mute-${group.name}'),
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    value: !widget.controller.mutedGroups.contains(group.name),
                    onChanged: (_) =>
                        widget.controller.toggleGroupMuted(group.name),
                    title: Text(groupDisplayName(group.name)),
                    subtitle: Text(
                      '${group.feedCount} 源 · ${group.unreadEntries} 未读',
                    ),
                  ),
              const SizedBox(height: 8),
              FilledButton(
                key: const ValueKey('filter-done'),
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('完成'),
              ),
            ],
          ),
        );
      },
    );
  }
}
