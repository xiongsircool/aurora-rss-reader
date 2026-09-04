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

  @override
  void initState() {
    super.initState();
    widget.controller.clearSearch();
  }

  @override
  void dispose() {
    _queryController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
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
            onSubmitted: widget.controller.search,
          ),
          actions: [
            IconButton(
              tooltip: '搜索',
              onPressed: () => widget.controller.search(_queryController.text),
              icon: const Icon(Icons.search),
            ),
            if (_queryController.text.isNotEmpty)
              IconButton(
                tooltip: '清空',
                onPressed: () {
                  _queryController.clear();
                  widget.controller.clearSearch();
                  setState(() {});
                },
                icon: const Icon(Icons.close),
              ),
          ],
        ),
        body: _body(context),
      ),
    );
  }

  Widget _body(BuildContext context) {
    if (widget.controller.searching) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_queryController.text.trim().isEmpty) {
      return const _SearchEmpty(icon: Icons.search, title: '搜索本地文章');
    }
    if (widget.controller.searchResults.isEmpty) {
      return const _SearchEmpty(
        icon: Icons.search_off_outlined,
        title: '没有匹配文章',
      );
    }

    return ListView.separated(
      itemCount: widget.controller.searchResults.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final entry = widget.controller.searchResults[index];
        final feedTitle = widget.controller.feedTitle(entry.feedId);
        return EntryTile(
          entry: entry,
          feedTitle: feedTitle,
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => ArticleReaderPage(
                entry: entry,
                feedTitle: feedTitle,
                controller: widget.controller,
              ),
            ),
          ),
          onReadChanged: (read) => widget.controller.setRead(entry, read: read),
          onStarredChanged: (starred) =>
              widget.controller.setStarred(entry, starred: starred),
        );
      },
    );
  }
}

final class _SearchEmpty extends StatelessWidget {
  const _SearchEmpty({required this.icon, required this.title});

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 42, color: Theme.of(context).colorScheme.secondary),
          const SizedBox(height: 14),
          Text(title, style: Theme.of(context).textTheme.titleMedium),
        ],
      ),
    );
  }
}
