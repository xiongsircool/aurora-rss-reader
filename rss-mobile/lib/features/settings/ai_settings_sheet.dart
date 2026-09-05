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
  final _modelIdController = TextEditingController();
  final _modelNameController = TextEditingController();
  final _apiKeyController = TextEditingController();
  final _maxTokensController = TextEditingController();
  final _contextWindowController = TextEditingController();
  double _temperature = 0.7;
  int _timeoutSeconds = 60;
  int _maxRetries = 2;
  String _language = 'zh';
  bool _reasoning = false;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    widget.controller.repository.loadAiConfig().then((value) {
      if (!mounted) return;
      _baseUrlController.text = value.baseUrl;
      _modelIdController.text = value.model;
    });
    widget.controller.loadSummaryKey().then((key) {
      if (mounted && key != null && key.isNotEmpty) {
        _apiKeyController.text = key;
      }
    });
    // Load extended settings from prefs
    widget.controller.loadAiExtendedSettings().then((settings) {
      if (!mounted || settings == null) return;
      setState(() {
        _temperature = settings['temperature'] as double? ?? 0.7;
        _timeoutSeconds = settings['timeoutSeconds'] as int? ?? 60;
        _maxRetries = settings['maxRetries'] as int? ?? 2;
        _language = settings['language'] as String? ?? 'zh';
        _reasoning = settings['reasoning'] as bool? ?? false;
        _maxTokensController.text = (settings['maxTokens'] as int? ?? 16384)
            .toString();
        _modelNameController.text = settings['modelName'] as String? ?? '';
      });
    });
  }

  @override
  void dispose() {
    _baseUrlController.dispose();
    _modelIdController.dispose();
    _modelNameController.dispose();
    _apiKeyController.dispose();
    _maxTokensController.dispose();
    _contextWindowController.dispose();
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
    final modelId = _modelIdController.text.trim();
    final key = _apiKeyController.text.trim();
    final maxTokens = int.tryParse(_maxTokensController.text.trim()) ?? 16384;

    if (baseUrl.isEmpty && (modelId.isNotEmpty || key.isNotEmpty)) {
      setState(() {
        _saving = false;
        _error = '请填写 API 端点';
      });
      return;
    }
    if (baseUrl.isNotEmpty && modelId.isEmpty) {
      setState(() {
        _saving = false;
        _error = '请填写模型 ID';
      });
      return;
    }
    if (maxTokens < 100 || maxTokens > 1000000) {
      setState(() {
        _saving = false;
        _error = 'Max Tokens 应在 100-1000000 之间';
      });
      return;
    }

    try {
      await widget.controller.saveAiSettings(
        baseUrl: baseUrl,
        model: modelId,
        apiKey: key,
      );
      await widget.controller.saveAiExtendedSettings({
        'temperature': _temperature,
        'maxTokens': maxTokens,
        'timeoutSeconds': _timeoutSeconds,
        'maxRetries': _maxRetries,
        'language': _language,
        'reasoning': _reasoning,
        'modelName': _modelNameController.text.trim(),
      });
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
              '配置 OpenAI 兼容接口，支持自定义模型参数。',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 18),

            // ── 基础配置 ──
            _SectionLabel('基础配置'),
            TextField(
              controller: _baseUrlController,
              enabled: !_saving,
              keyboardType: TextInputType.url,
              autocorrect: false,
              decoration: const InputDecoration(
                labelText: 'API 端点',
                hintText: 'https://api.siliconflow.cn/v1',
                prefixIcon: Icon(Icons.language),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _modelIdController,
              enabled: !_saving,
              decoration: const InputDecoration(
                labelText: '模型 ID',
                hintText: 'deepseek-ai/DeepSeek-V3',
                prefixIcon: Icon(Icons.smart_toy_outlined),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _modelNameController,
              enabled: !_saving,
              decoration: const InputDecoration(
                labelText: '显示名称（可选）',
                hintText: 'DeepSeek V3',
                prefixIcon: Icon(Icons.label_outline),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _apiKeyController,
              enabled: !_saving,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'API Key',
                hintText: 'sk-...',
                prefixIcon: Icon(Icons.key_outlined),
                border: OutlineInputBorder(),
              ),
            ),

            const SizedBox(height: 20),

            // ── 模型参数 ──
            _SectionLabel('模型参数'),
            TextField(
              controller: _maxTokensController,
              enabled: !_saving,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: '最大输出 Tokens',
                hintText: '16384',
                prefixIcon: Icon(Icons.data_usage),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            _SliderTile(
              label: 'Temperature',
              value: _temperature,
              min: 0.0,
              max: 2.0,
              divisions: 20,
              display: _temperature.toStringAsFixed(1),
              onChanged: (v) => setState(() => _temperature = v),
            ),
            SwitchListTile(
              dense: true,
              title: const Text('支持推理/思考'),
              subtitle: const Text('模型支持 extended thinking'),
              value: _reasoning,
              onChanged: (v) => setState(() => _reasoning = v),
            ),

            const SizedBox(height: 8),

            // ── 请求设置 ──
            _SectionLabel('请求设置'),
            _SliderTile(
              label: '超时（秒）',
              value: _timeoutSeconds.toDouble(),
              min: 10,
              max: 300,
              divisions: 29,
              display: '${_timeoutSeconds}s',
              onChanged: (v) => setState(() => _timeoutSeconds = v.toInt()),
            ),
            _SliderTile(
              label: '重试次数',
              value: _maxRetries.toDouble(),
              min: 0,
              max: 5,
              divisions: 5,
              display: '$_maxRetries',
              onChanged: (v) => setState(() => _maxRetries = v.toInt()),
            ),

            const SizedBox(height: 8),

            // ── 语言 ──
            _SectionLabel('输出语言'),
            Wrap(
              spacing: 8,
              children: [
                for (final lang in [
                  ('zh', '中文'),
                  ('en', 'English'),
                  ('ja', '日本語'),
                  ('ko', '한국어'),
                ])
                  ChoiceChip(
                    label: Text(lang.$2),
                    selected: _language == lang.$1,
                    onSelected: (_) => setState(() => _language = lang.$1),
                  ),
              ],
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

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
          color: Theme.of(context).colorScheme.primary,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _SliderTile extends StatelessWidget {
  const _SliderTile({
    required this.label,
    required this.value,
    required this.min,
    required this.max,
    required this.divisions,
    required this.display,
    required this.onChanged,
  });

  final String label;
  final double value;
  final double min;
  final double max;
  final int divisions;
  final String display;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
              Text(
                display,
                style: Theme.of(context).textTheme.bodySmall
                    ?.copyWith(fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
        SliderTheme(
          data: SliderThemeData(
            overlayShape: const RoundSliderOverlayShape(overlayRadius: 16),
            trackHeight: 3,
          ),
          child: Slider(
            value: value,
            min: min,
            max: max,
            divisions: divisions,
            onChanged: onChanged,
          ),
        ),
      ],
    );
  }
}
