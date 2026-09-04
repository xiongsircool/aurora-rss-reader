import 'package:flutter/material.dart';
import 'package:html/parser.dart' as html_parser;

import '../../domain/entities/entry.dart';
import '../../shared/image_viewer_page.dart';

final class EntryTile extends StatelessWidget {
  const EntryTile({
    required this.entry,
    required this.feedTitle,
    required this.onReadChanged,
    required this.onStarredChanged,
    this.onTap,
    this.referer,
    super.key,
  });

  final Entry entry;
  final String feedTitle;
  final ValueChanged<bool> onReadChanged;
  final ValueChanged<bool> onStarredChanged;
  final VoidCallback? onTap;

  /// Feed page URL sent as Referer for cover images; some site CDNs
  /// reject image requests without it.
  final Uri? referer;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final date = entry.publishedAt ?? entry.insertedAt;
    final summary = entry.summary == null
        ? null
        : html_parser.parseFragment(entry.summary!).text?.trim();
    final showSummary = summary != null && summary.isNotEmpty;

    return Material(
      color: entry.isRead
          ? colorScheme.surface
          : colorScheme.primary.withValues(alpha: 0.035),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 10, 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (entry.imageUrl != null) ...[
                GestureDetector(
                  onTap: () => ImageViewerPage.show(
                    context,
                    url: entry.imageUrl!,
                    referer: referer,
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(6),
                    child: Image.network(
                      entry.imageUrl.toString(),
                      headers: referer == null
                          ? null
                          : {'Referer': referer.toString()},
                      width: 88,
                      height: 76,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => Container(
                        width: 88,
                        height: 76,
                        color: colorScheme.surfaceContainerHighest,
                        alignment: Alignment.center,
                        child: const Icon(Icons.broken_image_outlined),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (!entry.isRead) ...[
                          Container(
                            width: 7,
                            height: 7,
                            decoration: BoxDecoration(
                              color: colorScheme.primary,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 7),
                        ],
                        Expanded(
                          child: Text(
                            feedTitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.labelMedium
                                ?.copyWith(color: colorScheme.onSurfaceVariant),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _formatDate(date),
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(color: colorScheme.onSurfaceVariant),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      entry.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: entry.isRead
                            ? FontWeight.w500
                            : FontWeight.w700,
                        height: 1.35,
                      ),
                    ),
                    if (showSummary) ...[
                      const SizedBox(height: 5),
                      Text(
                        summary.trim(),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                          height: 1.35,
                        ),
                      ),
                    ],
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          tooltip: entry.isStarred ? '取消收藏' : '收藏',
                          onPressed: () => onStarredChanged(!entry.isStarred),
                          icon: Icon(
                            entry.isStarred ? Icons.star : Icons.star_border,
                            color: entry.isStarred
                                ? const Color(0xFFF4A000)
                                : null,
                            size: 20,
                          ),
                        ),
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          tooltip: entry.isRead ? '标为未读' : '标为已读',
                          onPressed: () => onReadChanged(!entry.isRead),
                          icon: Icon(
                            entry.isRead
                                ? Icons.mark_email_unread_outlined
                                : Icons.check_circle_outline,
                            size: 20,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _formatDate(DateTime date) {
  final local = date.toLocal();
  final now = DateTime.now();
  if (local.year == now.year &&
      local.month == now.month &&
      local.day == now.day) {
    return '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  }
  return '${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')}';
}
