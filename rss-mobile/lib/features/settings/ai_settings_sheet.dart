import 'package:flutter/material.dart';

import '../reader/mobile_reader_controller.dart';

Future<void> showAiSettingsSheet(
  BuildContext context,
  MobileReaderController controller,
) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => _AiSettingsSheet(controller: controller),
  );
}

final class _AiSettingsSheet extends StatefulWidget {
  const _AiSettingsSheet({required this.controller});

  final MobileReaderController controller;

  @override
  State<_AiSettingsSheet> createState() => _AiSettingsSheetState();
}

class _AiSettingsSheetState extends State<_AiSettingsSheet> {
  final _baseUrlController = TextEditingController();
  final _modelController = TextEditingController();
  final _keyController = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    widget.controller.repository.loadAiConfig().then((value) {
      if (!mounted) return;
      _baseUrlController.text = value.baseUrl;
      _modelController.text = value.model;
    });
    widget.controller.loadSummaryKey().then((key) {
      if (mounted && key != null && key.isNotEmpty) {
        _keyController.text = key;
      }
    });
  }

  @override
  void dispose() {
    _baseUrlController.dispose();
    _modelController.dispose();
    _keyController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _saving = true;
      _error = null;
    });

    final baseUrl = _baseUrlController.text.trim();
    final model = _modelController.text.trim();
    final key = _keyController.text.trim();

    if (baseUrl.isEmpty && (model.isNotEmpty || key.isNotEmpty)) {
      setState(() {
        _saving = false;
        _error = '请填写 API 端点';
      });
      return;
    }
    if (baseUrl.isNotEmpty && model.isEmpty) {
      setState(() {
        _saving = false;
        _error = '请填写模型名称';
      });
      return;
    }

    try {
      await widget.controller.saveAiSettings(
        baseUrl: baseUrl,
        model: model,
        apiKey: key,
      );
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(baseUrl.isEmpty ? 'AI 设置已清空' : 'AI 设置已保存')),
      );
    } catch (error) {
      setState(() {
        _saving = false;
        _error = '保存失败：$error';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        4,
        20,
        24 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'AI 服务',
              style: Theme.of(context).textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Text(
              '配置 OpenAI 兼容接口用于文章摘要和翻译。',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 18),
            TextField(
              controller: _baseUrlController,
              enabled: !_saving,
              keyboardType: TextInputType.url,
              autocorrect: false,
              decoration: const InputDecoration(
                labelText: 'API 端点',
                hintText: 'https://api.openai.com/v1',
                prefixIcon: Icon(Icons.language),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _modelController,
              enabled: !_saving,
              decoration: const InputDecoration(
                labelText: '模型',
                hintText: 'gpt-4o-mini',
                prefixIcon: Icon(Icons.smart_toy_outlined),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _keyController,
              enabled: !_saving,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'API Key',
                hintText: 'sk-...',
                prefixIcon: Icon(Icons.key_outlined),
                border: OutlineInputBorder(),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.error,
                  fontSize: 13,
                ),
              ),
            ],
            const SizedBox(height: 18),
            FilledButton(
              onPressed: _saving ? null : _save,
              child: SizedBox(
                height: 48,
                child: Center(
                  child: _saving
                      ? const SizedBox.square(
                          dimension: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Colors.white,
                          ),
                        )
                      : const Text('保存'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
