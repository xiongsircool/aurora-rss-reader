import 'package:flutter/material.dart';

import '../reader/mobile_reader_controller.dart';

Future<void> showProxySettingsDialog(
  BuildContext context,
  MobileReaderController controller,
) {
  return showDialog<void>(
    context: context,
    builder: (_) => _ProxySettingsDialog(controller: controller),
  );
}

final class _ProxySettingsDialog extends StatefulWidget {
  const _ProxySettingsDialog({required this.controller});

  final MobileReaderController controller;

  @override
  State<_ProxySettingsDialog> createState() => _ProxySettingsDialogState();
}

class _ProxySettingsDialogState extends State<_ProxySettingsDialog> {
  late final TextEditingController _textController;
  String? _validationError;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController(
      text: widget.controller.proxyUrl ?? '',
    );
  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _saving = true;
      _validationError = null;
    });

    final saved = await widget.controller.saveProxyUrl(_textController.text);
    if (!mounted) return;
    if (saved) {
      Navigator.of(context).pop();
    } else {
      setState(() {
        _saving = false;
        _validationError = widget.controller.error;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('网络代理'),
      content: SingleChildScrollView(
        child: TextField(
          key: const ValueKey('proxy-url-input'),
          controller: _textController,
          enabled: !_saving,
          keyboardType: TextInputType.url,
          textInputAction: TextInputAction.done,
          autocorrect: false,
          decoration: InputDecoration(
            labelText: 'HTTP 代理',
            hintText: '127.0.0.1:7897',
            helperText: '留空则使用直连。',
            errorText: _validationError,
          ),
          onSubmitted: (_) => _save(),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.of(context).pop(),
          child: const Text('取消'),
        ),
        FilledButton(
          key: const ValueKey('proxy-save'),
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Text('保存'),
        ),
      ],
    );
  }
}
