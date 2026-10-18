import 'dart:async';

import 'package:flutter/material.dart';

import '../../data/repositories/local_content_repository.dart';
import '../reader/mobile_reader_controller.dart';
import '../../l10n/generated/app_localizations.dart';
import 'tag_picker_sheet.dart' show tagDotColor;

/// Settings page: rename, recolor or delete tags. Deleting a tag only
/// removes its associations; entries and stars are untouched.
final class TagManagementPage extends StatefulWidget {
  const TagManagementPage({super.key, required this.controller});

  final MobileReaderController controller;

  @override
  State<TagManagementPage> createState() => _TagManagementPageState();
}

class _TagManagementPageState extends State<TagManagementPage> {
  @override
  void initState() {
    super.initState();
    widget.controller.reloadTags();
  }

  Future<void> _editTag(BuildContext context, TagSummary tag) async {
    final l = AppLocalizations.of(context)!;
    final nameController = TextEditingController(text: tag.name);
    var color = tag.color;
    final saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: Text(l.tagRename),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: nameController,
                autofocus: true,
                decoration: InputDecoration(
                  hintText: l.tagRename,
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              Text(l.tagColor, style: Theme.of(dialogContext).textTheme.labelLarge),
              const SizedBox(height: 8),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  for (final candidate in kTagPalette)
                    GestureDetector(
                      onTap: () => setDialogState(() => color = candidate),
                      child: Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: tagDotColor(candidate),
                          shape: BoxShape.circle,
                          border: candidate == color
                              ? Border.all(
                                  color: Theme.of(
                                    dialogContext,
                                  ).colorScheme.onSurface,
                                  width: 2.5,
                                )
                              : null,
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () async {
                Navigator.pop(dialogContext, false);
                await _deleteTagConfirmed(tag);
              },
              style: TextButton.styleFrom(
                foregroundColor: Theme.of(dialogContext).colorScheme.error,
              ),
              child: Text(l.delete),
            ),
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: Text(l.cancel),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: Text(l.save),
            ),
          ],
        ),
      ),
    );
    if (saved != true) return;
    final name = nameController.text.trim();
    if (name.isNotEmpty && name != tag.name) {
      await widget.controller.repository.renameTag(tag.id, name);
    }
    if (color != tag.color) {
      await widget.controller.repository.updateTagColor(tag.id, color);
    }
    await widget.controller.reloadTags();
  }

  Future<void> _deleteTagConfirmed(TagSummary tag) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(AppLocalizations.of(dialogContext)!.tagDelete),
        content: Text(AppLocalizations.of(dialogContext)!.tagDeleteConfirmBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(AppLocalizations.of(dialogContext)!.cancel),
          ),
          FilledButton.tonal(
            style: FilledButton.styleFrom(
              foregroundColor: Theme.of(dialogContext).colorScheme.error,
            ),
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(AppLocalizations.of(dialogContext)!.delete),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await widget.controller.repository.deleteTag(tag.id);
    await widget.controller.reloadTags();
  }

  Future<void> _deleteTag(BuildContext context, TagSummary tag) async {
    final l = AppLocalizations.of(context)!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l.tagDelete),
        content: Text(l.tagDeleteConfirmBody),
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
    await widget.controller.repository.deleteTag(tag.id);
    await widget.controller.reloadTags();
  }

  Future<void> _backfill() async {
    final l = AppLocalizations.of(context)!;
    if (widget.controller.refreshing) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l.tagAutoBackfillBusy)));
      return;
    }
    final progress = ValueNotifier<double?>(null);
    unawaited(
      showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => ValueListenableBuilder<double?>(
          valueListenable: progress,
          builder: (dialogContext, value, _) => AlertDialog(
            title: Text(l.tagAutoBackfill),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(l.tagAutoBackfillRunning),
                const SizedBox(height: 12),
                LinearProgressIndicator(
                  value: value,
                  minHeight: 6,
                  borderRadius: BorderRadius.circular(3),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    final messenger = ScaffoldMessenger.of(context);
    final l10n = l;
    try {
      final tagged = await widget.controller.repository.backfillAutoTags(
        onProgress: (done, total) =>
            progress.value = total == 0 ? 1 : done / total,
      );
      await widget.controller.reloadTags();
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.tagAutoBackfillDone(tagged))),
      );
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text('$error')));
    } finally {
      progress.dispose();
    }
    if (mounted) Navigator.of(context, rootNavigator: true).pop();
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(
        title: Text(l.tagManage),
        actions: [
          IconButton(
            tooltip: l.tagAutoBackfill,
            icon: const Icon(Icons.auto_awesome),
            onPressed: _backfill,
          ),
        ],
      ),
      body: AnimatedBuilder(
        animation: widget.controller,
        builder: (context, _) {
          final tags = widget.controller.tags;
          if (tags.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.label_outline,
                      size: 44,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      l.tagManageEmpty,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }
          return ListView.separated(
            itemCount: tags.length,
            separatorBuilder: (_, _) => Divider(
              height: 1,
              color: Theme.of(
                context,
              ).colorScheme.outlineVariant.withValues(alpha: 0.35),
            ),
            itemBuilder: (context, index) {
              final tag = tags[index];
              return ListTile(
                leading: Container(
                  width: 12,
                  height: 12,
                  margin: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: tagDotColor(tag.color),
                    shape: BoxShape.circle,
                  ),
                ),
                title: Text(tag.name),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      l.tagCount(tag.entryCount),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(width: 4),
                    IconButton(
                      tooltip: l.tagRename,
                      icon: const Icon(Icons.edit_outlined, size: 20),
                      onPressed: () => _editTag(context, tag),
                    ),
                  ],
                ),
                onLongPress: () => _deleteTag(context, tag),
              );
            },
          );
        },
      ),
    );
  }
}
