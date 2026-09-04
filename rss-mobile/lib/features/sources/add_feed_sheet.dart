import 'package:flutter/material.dart';

import '../reader/mobile_reader_controller.dart';

Future<void> showAddFeedSheet(
  BuildContext context,
  MobileReaderController controller,
) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (context) => _AddFeedSheet(controller: controller),
  );
}

final class _AddFeedSheet extends StatefulWidget {
  const _AddFeedSheet({required this.controller});

  final MobileReaderController controller;

  @override
  State<_AddFeedSheet> createState() => _AddFeedSheetState();
}

class _AddFeedSheetState extends State<_AddFeedSheet> {
  final _urlController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    final added = await widget.controller.addFeed(_urlController.text);
    if (added && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.controller,
      builder: (context, _) {
        return Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            4,
            20,
            20 + MediaQuery.viewInsetsOf(context).bottom,
          ),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  '添加订阅',
                  style: Theme.of(context).textTheme.titleLarge
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 6),
                Text(
                  '输入 RSS、Atom 或 Podcast 地址',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 20),
                TextFormField(
                  key: const ValueKey('feed-url-input'),
                  controller: _urlController,
                  autofocus: true,
                  enabled: !widget.controller.adding,
                  keyboardType: TextInputType.url,
                  textInputAction: TextInputAction.done,
                  autocorrect: false,
                  decoration: const InputDecoration(
                    labelText: '订阅地址',
                    hintText: 'https://example.com/feed.xml',
                    prefixIcon: Icon(Icons.link),
                    border: OutlineInputBorder(),
                  ),
                  validator: (value) =>
                      value == null || value.trim().isEmpty ? '请输入订阅地址' : null,
                  onFieldSubmitted: (_) => _submit(),
                ),
                if (widget.controller.error != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    widget.controller.error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                      fontSize: 13,
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                FilledButton(
                  key: const ValueKey('add-feed-submit'),
                  onPressed: widget.controller.adding ? null : _submit,
                  child: SizedBox(
                    height: 48,
                    child: Center(
                      child: widget.controller.adding
                          ? const SizedBox.square(
                              dimension: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : const Text('获取并添加'),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
