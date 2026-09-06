import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:html/parser.dart' as html_parser;

import '../../domain/entities/entry.dart';
import '../../shared/image_viewer_page.dart';

final class EntryTile extends StatefulWidget {
  const EntryTile({
    required this.entry,
    required this.feedTitle,
    required this.onReadChanged,
    required this.onStarredChanged,
    this.onTap,
    this.onVisible,
    this.referer,
    super.key,
  });

  final Entry entry;
  final String feedTitle;
  final ValueChanged<bool> onReadChanged;
  final ValueChanged<bool> onStarredChanged;
  final VoidCallback? onTap;

  /// Called once when the tile is built (≈ about to become visible).
  /// Used to request auto title translation for what the user sees.
  final VoidCallback? onVisible;

  /// Feed page URL sent as Referer for cover images; some site CDNs
  /// reject image requests without it.
  final Uri? referer;

  @override
  State<EntryTile> createState() => _EntryTileState();
}

final class _EntryTileState extends State<EntryTile> {
  @override
  void initState() {
    super.initState();
    // ListView.builder only builds tiles right before they scroll into
    // view, so "built" ≈ "visible". Fire once per tile instance.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.onVisible?.call();
    });
  }

  @override
  Widget build(BuildContext context) {
    return _build(context, widget);
  }

  Widget _build(BuildContext context, EntryTile tile) {
    final colorScheme = Theme.of(context).colorScheme;
    final date = tile.entry.publishedAt ?? tile.entry.insertedAt;
    final summary = tile.entry.summary == null
        ? null
        : html_parser.parseFragment(tile.entry.summary!).text?.trim();
    final showSummary = summary != null && summary.isNotEmpty;
    final avatarColor = _sourceColor(tile.feedTitle);

    return Material(
      color: tile.entry.isRead
          ? colorScheme.surface
          : colorScheme.primary.withValues(alpha: 0.045),
      child: InkWell(
        onTap: tile.onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 8, 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Feed avatar: soft-tinted circle with the source initial.
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: avatarColor.withValues(alpha: 0.16),
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  _sourceInitial(tile.feedTitle),
                  style: TextStyle(
                    color: avatarColor,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    height: 1,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Meta row: source + relative time.
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            tile.feedTitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.labelMedium
                                ?.copyWith(
                                  color: avatarColor,
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        if (!tile.entry.isRead) ...[
                          Container(
                            width: 7,
                            height: 7,
                            decoration: BoxDecoration(
                              color: colorScheme.primary,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 5),
                        ],
                        Text(
                          _relativeDate(date),
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(color: colorScheme.onSurfaceVariant),
                        ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(
                      tile.entry.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: tile.entry.isRead
                            ? FontWeight.w500
                            : FontWeight.w700,
                        height: 1.35,
                      ),
                    ),
                    if (tile.entry.translatedTitle != null &&
                        tile.entry.translatedTitle != tile.entry.title) ...[
                      const SizedBox(height: 2),
                      Text(
                        tile.entry.translatedTitle!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: Theme.of(context).colorScheme.secondary,
                        ),
                      ),
                    ],
                    if (showSummary) ...[
                      const SizedBox(height: 5),
                      Text(
                        summary,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                          height: 1.35,
                        ),
                      ),
                    ],
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          tooltip: tile.entry.isStarred ? '取消收藏' : '收藏',
                          onPressed: () =>
                              tile.onStarredChanged(!tile.entry.isStarred),
                          icon: Icon(
                            tile.entry.isStarred
                                ? Icons.star
                                : Icons.star_border,
                            color: tile.entry.isStarred
                                ? const Color(0xFFF4A000)
                                : null,
                            size: 20,
                          ),
                        ),
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          tooltip: tile.entry.isRead ? '标为未读' : '标为已读',
                          onPressed: () =>
                              tile.onReadChanged(!tile.entry.isRead),
                          icon: Icon(
                            tile.entry.isRead
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
              if (tile.entry.imageUrl != null) ...[
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: () => ImageViewerPage.show(
                    context,
                    url: tile.entry.imageUrl!,
                    referer: tile.referer,
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: CachedNetworkImage(
                      imageUrl: tile.entry.imageUrl.toString(),
                      httpHeaders: tile.referer == null
                          ? null
                          : {'Referer': tile.referer!.toString()},
                      width: 84,
                      height: 72,
                      fit: BoxFit.cover,
                      errorWidget: (_, _, _) => Container(
                        width: 84,
                        height: 72,
                        color: colorScheme.surfaceContainerHighest,
                        alignment: Alignment.center,
                        child: const Icon(Icons.broken_image_outlined),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Stable per-source color: a fixed pleasant palette indexed by a
/// deterministic hash (String.hashCode is seeded per run, so roll our own).
Color _sourceColor(String seed) {
  const palette = [
    0xFF087E8B, // teal
    0xFFE85D24, // orange
    0xFF1565C0, // blue
    0xFF6A1B9A, // purple
    0xFF2E7D32, // green
    0xFFAD1457, // pink
    0xFF00838F, // cyan
    0xFF558B2F, // olive
    0xFF827717, // lime dark
    0xFF4E5D6C, // slate
  ];
  var hash = 0;
  for (final code in seed.codeUnits) {
    hash = (hash * 31 + code) & 0x7fffffff;
  }
  return Color(palette[hash % palette.length]);
}

/// First meaningful character of the feed title, uppercased for latin.
String _sourceInitial(String title) {
  final trimmed = title.trim();
  if (trimmed.isEmpty) return '·';
  final first = trimmed.substring(0, 1);
  final lower = first.toLowerCase();
  if (lower != first && first != first.toUpperCase()) return first;
  return first.toUpperCase();
}

/// Compact relative time for the inbox meta row.
String _relativeDate(DateTime date) {
  final local = date.toLocal();
  final diff = DateTime.now().difference(local);
  if (diff.isNegative) return '刚刚';
  if (diff.inMinutes < 1) return '刚刚';
  if (diff.inMinutes < 60) return '${diff.inMinutes}分钟前';
  if (diff.inHours < 24) return '${diff.inHours}小时前';
  if (diff.inDays == 1) return '昨天';
  if (diff.inDays < 7) return '${diff.inDays}天前';
  if (local.year == DateTime.now().year) {
    return '${local.month}月${local.day}日';
  }
  return '${local.year}年${local.month}月${local.day}日';
}
