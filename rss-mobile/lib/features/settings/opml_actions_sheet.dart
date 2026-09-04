import 'dart:convert';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../reader/mobile_reader_controller.dart';

Future<void> showOpmlActionsSheet(
  BuildContext context,
  MobileReaderController controller,
) {
  return showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => _OpmlActionsSheet(controller: controller),
  );
}

final class _OpmlActionsSheet extends StatefulWidget {
  const _OpmlActionsSheet({required this.controller});

  final MobileReaderController controller;

  @override
  State<_OpmlActionsSheet> createState() => _OpmlActionsSheetState();
}

class _OpmlActionsSheetState extends State<_OpmlActionsSheet> {
  bool _busy = false;
  String? _error;

  Future<void> _import() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final files = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['opml', 'xml'],
      );
      if (files.isEmpty) return;
      final bytes = await files.single.readAsBytes();
      final count = await widget.controller.importOpml(bytes);
      if (count > 0 && mounted) Navigator.of(context).pop();
      if (count == 0) _error = widget.controller.error ?? '文件中没有有效订阅';
    } catch (error) {
      _error = '导入失败：$error';
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _export() async {
    if (_busy) return;
    if (widget.controller.feeds.isEmpty) {
      setState(() => _error = '当前没有可导出的订阅');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final data = Uint8List.fromList(
        utf8.encode(widget.controller.exportOpml()),
      );
      final box = context.findRenderObject() as RenderBox?;
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile.fromData(data, mimeType: 'text/x-opml')],
          fileNameOverrides: const ['aurora-subscriptions.opml'],
          sharePositionOrigin: box == null
              ? null
              : box.localToGlobal(Offset.zero) & box.size,
        ),
      );
    } catch (error) {
      _error = '导出失败：$error';
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'OPML',
            style: Theme.of(context).textTheme.titleLarge
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          if (_error != null) ...[
            const SizedBox(height: 10),
            Text(
              _error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: 14),
          ListTile(
            enabled: !_busy,
            leading: const Icon(Icons.file_open_outlined),
            title: const Text('导入 OPML'),
            trailing: const Icon(Icons.chevron_right),
            onTap: _busy ? null : _import,
          ),
          const Divider(height: 1),
          ListTile(
            enabled: !_busy,
            leading: const Icon(Icons.ios_share_outlined),
            title: const Text('导出 OPML'),
            subtitle: Text('${widget.controller.feeds.length} 个订阅'),
            trailing: _busy
                ? const SizedBox.square(
                    dimension: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.chevron_right),
            onTap: _busy ? null : _export,
          ),
        ],
      ),
    );
  }
}
