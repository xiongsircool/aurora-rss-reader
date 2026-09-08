import 'package:flutter/material.dart';

/// Highlight a literal search phrase while preserving normal text semantics.
class HighlightedText extends StatelessWidget {
  const HighlightedText(
    this.text, {
    this.query = '',
    this.style,
    this.maxLines = 2,
    super.key,
  });
  final String text;
  final String query;
  final TextStyle? style;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    final needle = query.trim().toLowerCase();
    final spans = <InlineSpan>[];
    var start = 0;
    if (needle.isNotEmpty) {
      final lower = text.toLowerCase();
      while (start < text.length) {
        final index = lower.indexOf(needle, start);
        if (index < 0) break;
        if (index > start) {
          spans.add(TextSpan(text: text.substring(start, index)));
        }
        spans.add(
          TextSpan(
            text: text.substring(index, index + needle.length),
            style: TextStyle(
              backgroundColor: Theme.of(context).colorScheme.secondaryContainer,
              color: Theme.of(context).colorScheme.onSecondaryContainer,
              fontWeight: FontWeight.w700,
            ),
          ),
        );
        start = index + needle.length;
      }
    }
    spans.add(TextSpan(text: text.substring(start)));
    return Text.rich(
      TextSpan(children: spans),
      style: style,
      maxLines: maxLines,
      overflow: TextOverflow.ellipsis,
    );
  }
}
