import 'package:flutter/material.dart';

import '../../domain/entities/entry.dart';
import '../inbox/entry_tile.dart';
import '../reader/article_reader_page.dart';
import '../reader/mobile_reader_controller.dart';
import '../../l10n/generated/app_localizations.dart';
import 'tag_picker_sheet.dart' show tagDotColor;

/// Shows every entry carrying one tag. v1: single-tag browsing; the
/// underlying query already accepts multiple ids for a future AND filter.
final class TagListPage extends StatefulWidget {
  const TagListPage({
    super.key,
    required this.controller,
    required this.tagId,
    required this.tagName,
    required this.tagColor,
  });

  final MobileReaderController controller;
  final String tagId;
  final String tagName;
  final String tagColor;

  @override
  State<TagListPage> createState() => _TagListPageState();
}

class _TagListPageState extends State<TagListPage> {
  List<Entry> _entries = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final entries = await widget.controller.repository.entriesByTag(
      widget.tagId,
    );
    if (!mounted) return;
    setState(() {
      _entries = entries;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                color: tagDotColor(widget.tagColor),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                widget.tagName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
      body: _loading
          ? const Center(
              child: SizedBox.square(
                dimension: 24,
                child: CircularProgressIndicator(strokeWidth: 2.4),
              ),
            )
          : _entries.isEmpty
          ? Center(
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
                    l.tagEntriesEmpty,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            )
          : ListView.separated(
              key: PageStorageKey('tag-${widget.tagId}'),
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: _entries.length,
              separatorBuilder: (_, _) => Divider(
                height: 1,
                color: Theme.of(
                  context,
                ).colorScheme.outlineVariant.withValues(alpha: 0.35),
              ),
              itemBuilder: (context, index) {
                final entry = _entries[index];
                final feedTitle = widget.controller.feedTitle(entry.feedId);
                return EntryTile(
                  key: ValueKey('tag-${widget.tagId}-${entry.id}'),
                  entry: entry,
                  feedTitle: feedTitle,
                  feedIconUrl: widget.controller.feedIconUrl(entry.feedId),
                  referer: widget.controller.feedUrl(entry.feedId),
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => ArticleReaderPage(
                          entry: entry,
                          feedTitle: feedTitle,
                          referer: widget.controller.feedUrl(entry.feedId),
                          controller: widget.controller,
                        ),
                      ),
                    );
                  },
                  onVisible: () =>
                      widget.controller.requestTitleTranslation(entry.id),
                  onReadChanged: (read) =>
                      widget.controller.setRead(entry, read: read),
                  onStarredChanged: (starred) =>
                      widget.controller.setStarred(entry, starred: starred),
                );
              },
            ),
    );
  }
}
