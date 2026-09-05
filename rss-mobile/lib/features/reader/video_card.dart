import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Video platform card that shows a thumbnail and opens in browser
/// or native app when tapped.
class VideoCard extends StatelessWidget {
  const VideoCard({
    required this.url,
    required this.title,
    this.referer,
    super.key,
  });

  final Uri url;
  final String title;
  final Uri? referer;

  String get _platform {
    final host = url.host.replaceFirst('www.', '');
    if (host.contains('youtube') || host == 'youtu.be') return 'YouTube';
    if (host.contains('bilibili')) return '哔哩哔哩';
    if (host.contains('vimeo')) return 'Vimeo';
    return '视频';
  }

  String get _platformIcon {
    final platform = _platform;
    if (platform == 'YouTube') return '▶';
    if (platform == '哔哩哔哩') return '📺';
    return '🎬';
  }

  String? get _thumbnailUrl {
    final host = url.host.replaceFirst('www.', '');
    // YouTube thumbnail from video ID.
    if (host == 'youtube.com' && url.path.contains('watch')) {
      final videoId = url.queryParameters['v'];
      if (videoId != null && videoId.isNotEmpty) {
        return 'https://i.ytimg.com/vi/$videoId/hqdefault.jpg';
      }
    }
    if (host == 'youtu.be') {
      final videoId = url.pathSegments.firstOrNull;
      if (videoId != null && videoId.isNotEmpty) {
        return 'https://i.ytimg.com/vi/$videoId/hqdefault.jpg';
      }
    }
    // Bilibili thumbnail from BV ID.
    if (host.contains('bilibili.com')) {
      final bvMatch = RegExp(r'(BV[0-9A-Za-z]+)').firstMatch(url.toString());
      if (bvMatch != null) {
        // Bilibili thumbnails need API call; use placeholder.
        return null;
      }
    }
    return null;
  }

  Future<void> _open() async {
    await launchUrl(url, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final thumbnail = _thumbnailUrl;

    return GestureDetector(
      onTap: _open,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: colorScheme.surfaceContainerHighest.withValues(alpha: 0.3),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: colorScheme.outline.withValues(alpha: 0.2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Thumbnail or placeholder
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(12),
              ),
              child: SizedBox(
                width: double.infinity,
                height: 180,
                child: thumbnail != null
                    ? Image.network(
                        thumbnail,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) =>
                            _buildPlaceholder(colorScheme, context),
                      )
                    : _buildPlaceholder(colorScheme, context),
              ),
            ),
            // Info bar
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Text(_platformIcon, style: const TextStyle(fontSize: 18)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium
                          ?.copyWith(fontWeight: FontWeight.w500),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: colorScheme.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      _platform,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: colorScheme.primary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlaceholder(ColorScheme colorScheme, BuildContext context) {
    return Container(
      color: colorScheme.surfaceContainerHighest,
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.play_circle_outline,
              size: 48,
              color: colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
            ),
            const SizedBox(height: 8),
            Text(
              _platform,
              style: Theme.of(context).textTheme.bodySmall
                  ?.copyWith(color: colorScheme.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}
