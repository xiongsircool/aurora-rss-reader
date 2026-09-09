import '../audio/podcast_overlay.dart';
import '../../shared/right_scrollbar.dart';

import 'dart:async';

import 'package:flutter/material.dart';

import '../inbox/entry_tile.dart';
import '../reader/article_reader_page.dart';
import '../reader/mobile_reader_controller.dart';

final class SearchPage extends StatefulWidget {
  const SearchPage({required this.controller, super.key});
  final MobileReaderController controller;
  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  final _queryController = TextEditingController();
  Timer? _debounce;
  bool _waiting = false;

  @override
  void initState() {
    super.initState();
    _queryController.addListener(_onQueryChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) widget.controller.clearSearch();
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _queryController.removeListener(_onQueryChanged);
    _queryController.dispose();
    super.dispose();
  }

  void _onQueryChanged() {
    _debounce?.cancel();
    widget.controller
        .clearSearch(); // invalidate requests for the previous text
    setState(() => _waiting = _queryController.text.trim().isNotEmpty);
    if (_waiting) _debounce = Timer(const Duration(milliseconds: 350), _submit);
  }

  void _submit([String? _]) {
    _debounce?.cancel();
    setState(() => _waiting = false);
    widget.controller.search(_queryController.text);
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, _) => Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: TextField(
          key: const ValueKey('search-input'),
          controller: _queryController,
          autofocus: true,
          textInputAction: TextInputAction.search,
          decoration: const InputDecoration(
            hintText: '搜索标题和正文',
            border: InputBorder.none,
          ),
          onSubmitted: _submit,
        ),
        actions: [
          IconButton(
            tooltip: '搜索',
            onPressed: _submit,
            icon: const Icon(Icons.search),
          ),
          if (_queryController.text.isNotEmpty)
            IconButton(
              tooltip: '清空',
              onPressed: _queryController.clear,
              icon: const Icon(Icons.close),
            ),
        ],
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 850),
          child: _body(context),
        ),
      ),
    ),
  );

  Widget _body(BuildContext context) {
    if (_queryController.text.trim().isEmpty) {
      return const Center(
        child: Text('搜索本地文章\n已缓存的正文也可以搜索', textAlign: TextAlign.center),
      );
    }
    if (_waiting || widget.controller.searching) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('正在搜索…'),
          ],
        ),
      );
    }
    if (widget.controller.searchError != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(widget.controller.searchError!),
            TextButton(onPressed: _submit, child: const Text('重试')),
          ],
        ),
      );
    }
    final results = widget.controller.searchResults;
    if (results.isEmpty) {
      return const Center(
        child: Text('没有匹配文章\n试试更短的关键词', textAlign: TextAlign.center),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: Text(
            '显示 ${results.length} 条匹配结果',
            style: Theme.of(context).textTheme.labelMedium,
          ),
        ),
        Expanded(
          child: RightScrollView(
            bottomClearance: PodcastInsets.of(context),
            builder: (context, scrollController) => ListView.separated(
              controller: scrollController,
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: EdgeInsets.only(
                bottom:
                    MediaQuery.paddingOf(context).bottom +
                    16 +
                    PodcastInsets.of(context),
              ),
              itemCount: results.length,
              separatorBuilder: (_, _) => Divider(
                height: 1,
                color: Theme.of(context).colorScheme.outlineVariant
                    .withValues(alpha: 0.35),
              ),
              itemBuilder: (context, index) {
                final entry = results[index];
                final feedTitle = widget.controller.feedTitle(entry.feedId);
                return EntryTile(
                  key: ValueKey(entry.id),
                  entry: entry,
                  feedTitle: feedTitle,
                  highlightQuery: _queryController.text,
                  feedIconUrl: widget.controller.feedIconUrl(entry.feedId),
                  referer: widget.controller.feedUrl(entry.feedId),
                  onTap: () {
                    FocusScope.of(context).unfocus();
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
                  onReadChanged: (read) =>
                      widget.controller.setRead(entry, read: read),
                  onStarredChanged: (starred) =>
                      widget.controller.setStarred(entry, starred: starred),
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}
