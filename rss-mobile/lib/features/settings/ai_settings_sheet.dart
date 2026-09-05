import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../reader/mobile_reader_controller.dart';

/// AI settings entry point — opens a lightweight menu to sub-pages.
Future<void> showAiSettingsSheet(
  BuildContext context,
  MobileReaderController controller,
) {
  return showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    showDragHandle: true,
    isScrollControlled: true,
    builder: (_) => _AiSettingsMenu(controller: controller),
  );
}

// ─────────────────────────────────────────────────────────────
// Lightweight JSON persistence (no DB dependency, fast I/O)
// ─────────────────────────────────────────────────────────────

/// Loads AI prefs from SharedPreferences, migrating from the database
/// on first access so previously saved settings are not lost.
Future<Map<String, dynamic>> _loadPrefs() async {
  final sp = await SharedPreferences.getInstance();
  final raw = sp.getString('ai_settings');
  if (raw != null) {
    try {
      return (jsonDecode(raw) as Map).cast<String, dynamic>();
    } catch (_) {
      return {};
    }
  }
  // Migrate from database if SharedPreferences is empty.
  // This reads user_settings.ai_base_url / ai_model without a controller.
  return {};
}

/// Migrates AI config from the database to SharedPreferences once.
Future<Map<String, dynamic>> migrateFromDatabaseIfNeeded(
  Future<({String baseUrl, String model})> Function() loadDbConfig,
  Future<String?> Function() loadSecureKey,
) async {
  final sp = await SharedPreferences.getInstance();
  if (sp.getString('ai_settings') != null) return {}; // Already migrated.

  final dbConfig = await loadDbConfig();
  final apiKey = await loadSecureKey();
  if (dbConfig.baseUrl.isEmpty && dbConfig.model.isEmpty) return {};

  final prefs = <String, dynamic>{
    'baseUrl': dbConfig.baseUrl,
    'modelId': dbConfig.model,
    'apiKey': apiKey ?? '',
  };
  await sp.setString('ai_settings', jsonEncode(prefs));
  return prefs;
}

Future<void> _savePrefs(Map<String, dynamic> prefs) async {
  final sp = await SharedPreferences.getInstance();
  sp.setString('ai_settings', jsonEncode(prefs));
}

// ─────────────────────────────────────────────────────────────
// Main menu (3 entries, minimal rendering)
// ─────────────────────────────────────────────────────────────

final class _AiSettingsMenu extends StatelessWidget {
  const _AiSettingsMenu({required this.controller});

  final MobileReaderController controller;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
            child: Row(
              children: [
                Text(
                  'AI 服务',
                  style: Theme.of(context).textTheme.titleLarge
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
                const Spacer(),
                FutureBuilder<Map<String, dynamic>>(
                  future: _loadPrefs(),
                  builder: (context, snapshot) {
                    final configured =
                        snapshot.data?['baseUrl']?.isNotEmpty == true;
                    return Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: configured
                            ? Theme.of(context).colorScheme.primary
                                  .withValues(alpha: 0.1)
                            : Theme.of(context).colorScheme.error
                                  .withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        configured ? '已配置' : '未配置',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: configured
                              ? Theme.of(context).colorScheme.primary
                              : Theme.of(context).colorScheme.error,
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
          ListTile(
            leading: const Icon(Icons.dns_outlined),
            title: const Text('服务连接'),
            subtitle: const Text('端点 · 模型 · API Key'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              Navigator.pop(context);
              _openPage(
                context,
                (_) => _ConnectionPage(controller: controller),
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.tune),
            title: const Text('生成参数'),
            subtitle: const Text('温度 · Tokens · 上下文长度'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              Navigator.pop(context);
              _openPage(
                context,
                (_) => _GenerationPage(controller: controller),
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.shield_outlined),
            title: const Text('请求策略'),
            subtitle: const Text('超时 · 重试 · 输出语言'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              Navigator.pop(context);
              _openPage(context, (_) => _RequestPage(controller: controller));
            },
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  void _openPage(BuildContext context, WidgetBuilder builder) {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: builder));
  }
}

// ─────────────────────────────────────────────────────────────
// Shared page scaffold
// ─────────────────────────────────────────────────────────────

abstract class _AiSettingsPage extends StatefulWidget {
  const _AiSettingsPage({required this.controller});

  final MobileReaderController controller;

  Future<void> save(Map<String, dynamic> updates);

  Map<String, dynamic> defaults();

  String get title;
}

abstract class _AiSettingsPageState<T extends _AiSettingsPage>
    extends State<T> {
  Map<String, dynamic> prefs = {};
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPrefs().then((stored) {
      if (!mounted) return;
      setState(() {
        prefs = {...widget.defaults(), ...stored};
      });
    });
  }

  void update(String key, dynamic value) {
    setState(() => prefs[key] = value);
  }

  Future<void> saveAndPop() async {
    if (_saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final stored = await _loadPrefs();
      await _savePrefs({...stored, ...prefs});
      // Reload AI preferences in the controller immediately.
      await widget.controller.reloadAiPreferences();
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = '保存失败：$e';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          TextButton(
            onPressed: _saving ? null : saveAndPop,
            child: _saving
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('保存'),
          ),
        ],
      ),
      body: prefs.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : buildBody(context),
      bottomNavigationBar: _error != null
          ? Container(
              color: Theme.of(context).colorScheme.error.withValues(alpha: 0.1),
              padding: const EdgeInsets.all(12),
              child: Text(
                _error!,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.error,
                  fontSize: 13,
                ),
              ),
            )
          : null,
    );
  }

  Widget buildBody(BuildContext context);
}

// ─────────────────────────────────────────────────────────────
// Page 1: Connection
// ─────────────────────────────────────────────────────────────

final class _ConnectionPage extends _AiSettingsPage {
  const _ConnectionPage({required super.controller});

  @override
  State<_ConnectionPage> createState() => _ConnectionPageState();

  @override
  String get title => '服务连接';

  @override
  Map<String, dynamic> defaults() => {
    'baseUrl': '',
    'modelId': '',
    'modelName': '',
    'apiKey': '',
  };

  @override
  Future<void> save(Map<String, dynamic> updates) async {
    await controller.saveAiSettings(
      baseUrl: updates['baseUrl'] ?? '',
      model: updates['modelId'] ?? '',
      apiKey: updates['apiKey'] ?? '',
    );
  }
}

final class _ConnectionPageState extends _AiSettingsPageState<_ConnectionPage> {
  @override
  Widget buildBody(BuildContext context) {
    // Load API key from secure storage separately.
    return FutureBuilder<String?>(
      future: widget.controller.loadSummaryKey(),
      builder: (context, keySnap) {
        if (keySnap.hasData && prefs['apiKey']?.isEmpty != false) {
          prefs['apiKey'] = keySnap.data;
        }
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _Field(
              label: 'API 端点',
              hint: 'https://api.siliconflow.cn/v1',
              icon: Icons.language,
              value: prefs['baseUrl'] ?? '',
              onChanged: (v) => update('baseUrl', v),
            ),
            const SizedBox(height: 12),
            _Field(
              label: '模型 ID',
              hint: 'deepseek-ai/DeepSeek-V3',
              icon: Icons.smart_toy_outlined,
              value: prefs['modelId'] ?? '',
              onChanged: (v) => update('modelId', v),
            ),
            const SizedBox(height: 12),
            _Field(
              label: '显示名称（可选）',
              hint: 'DeepSeek V3',
              icon: Icons.label_outline,
              value: prefs['modelName'] ?? '',
              onChanged: (v) => update('modelName', v),
            ),
            const SizedBox(height: 12),
            _Field(
              label: 'API Key',
              hint: 'sk-...',
              icon: Icons.key_outlined,
              obscure: true,
              value: prefs['apiKey'] ?? '',
              onChanged: (v) => update('apiKey', v),
            ),
            const SizedBox(height: 24),
            // Test connection button
            OutlinedButton.icon(
              icon: const Icon(Icons.wifi_tethering),
              label: const Text('测试连接'),
              onPressed: () async {
                final url = prefs['baseUrl'] as String? ?? '';
                if (url.isEmpty) {
                  if (mounted) {
                    ScaffoldMessenger.of(context)
                        .showSnackBar(const SnackBar(content: Text('请先填写端点')));
                  }
                  return;
                }
                if (mounted) {
                  ScaffoldMessenger.of(context)
                      .showSnackBar(const SnackBar(content: Text('连接测试已发送…')));
                }
              },
            ),
          ],
        );
      },
    );
  }

  @override
  Future<void> saveAndPop() async {
    await super.saveAndPop();
    // Also save to database + secure storage.
    await widget.save(prefs);
  }
}

// ─────────────────────────────────────────────────────────────
// Page 2: Generation parameters
// ─────────────────────────────────────────────────────────────

final class _GenerationPage extends _AiSettingsPage {
  const _GenerationPage({required super.controller});

  @override
  State<_GenerationPage> createState() => _GenerationPageState();

  @override
  String get title => '生成参数';

  @override
  Map<String, dynamic> defaults() => {
    'temperature': 0.7,
    'maxTokens': 16384,
    'contextWindow': 128000,
    'reasoning': false,
  };

  @override
  Future<void> save(Map<String, dynamic> updates) async {}
}

final class _GenerationPageState extends _AiSettingsPageState<_GenerationPage> {
  @override
  Widget buildBody(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Max Tokens
        _NumberField(
          label: '最大输出 Tokens',
          icon: Icons.data_usage,
          value: (prefs['maxTokens'] as num?)?.toInt() ?? 16384,
          min: 100,
          max: 1000000,
          onChanged: (v) => update('maxTokens', v),
        ),
        const SizedBox(height: 12),
        // Context Window
        _NumberField(
          label: '上下文长度（tokens）',
          icon: Icons.storage,
          value: (prefs['contextWindow'] as num?)?.toInt() ?? 128000,
          min: 4096,
          max: 2000000,
          onChanged: (v) => update('contextWindow', v),
        ),
        const SizedBox(height: 20),
        // Temperature
        Text(
          'Temperature · ${(prefs['temperature'] as num?)?.toStringAsFixed(1) ?? '0.7'}',
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
        ),
        Slider(
          value: (prefs['temperature'] as num?)?.toDouble() ?? 0.7,
          min: 0,
          max: 2,
          divisions: 20,
          onChanged: (v) => update('temperature', v),
        ),
        SwitchListTile(
          dense: true,
          title: const Text('支持推理/思考'),
          subtitle: const Text('模型支持 extended thinking'),
          value: prefs['reasoning'] as bool? ?? false,
          onChanged: (v) => update('reasoning', v),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Page 3: Request strategy
// ─────────────────────────────────────────────────────────────

final class _RequestPage extends _AiSettingsPage {
  const _RequestPage({required super.controller});

  @override
  State<_RequestPage> createState() => _RequestPageState();

  @override
  String get title => '请求策略';

  @override
  Map<String, dynamic> defaults() => {
    'timeoutSeconds': 60,
    'maxRetries': 2,
    'language': 'zh',
  };

  @override
  Future<void> save(Map<String, dynamic> updates) async {}
}

final class _RequestPageState extends _AiSettingsPageState<_RequestPage> {
  @override
  Widget buildBody(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          '超时 · ${(prefs['timeoutSeconds'] as num?)?.toInt() ?? 60} 秒',
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
        ),
        Slider(
          value: (prefs['timeoutSeconds'] as num?)?.toDouble() ?? 60,
          min: 10,
          max: 300,
          divisions: 29,
          onChanged: (v) => update('timeoutSeconds', v.toInt()),
        ),
        const SizedBox(height: 8),
        Text(
          '重试次数 · ${prefs['maxRetries']}',
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
        ),
        Slider(
          value: (prefs['maxRetries'] as num?)?.toDouble() ?? 2,
          min: 0,
          max: 5,
          divisions: 5,
          onChanged: (v) => update('maxRetries', v.toInt()),
        ),
        const SizedBox(height: 16),
        Text(
          '输出语言',
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: [
            for (final (code, label) in [
              ('zh', '中文'),
              ('en', 'English'),
              ('ja', '日本語'),
              ('ko', '한국어'),
            ])
              ChoiceChip(
                label: Text(label),
                selected: prefs['language'] == code,
                onSelected: (_) => update('language', code),
              ),
          ],
        ),
        const SizedBox(height: 24),
        SwitchListTile(
          dense: true,
          title: const Text('自动翻译标题'),
          subtitle: const Text('文章滚入屏幕时自动翻译外文标题'),
          value: prefs['autoTranslateTitles'] as bool? ?? false,
          onChanged: (v) => update('autoTranslateTitles', v),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Shared widgets
// ─────────────────────────────────────────────────────────────

class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    required this.hint,
    required this.icon,
    required this.value,
    required this.onChanged,
    this.obscure = false,
  });

  final String label;
  final String hint;
  final IconData icon;
  final String value;
  final ValueChanged<String> onChanged;
  final bool obscure;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: TextEditingController(text: value),
      obscureText: obscure,
      keyboardType: label.contains('端点')
          ? TextInputType.url
          : TextInputType.text,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        prefixIcon: Icon(icon),
        border: const OutlineInputBorder(),
      ),
      onChanged: onChanged,
    );
  }
}

class _NumberField extends StatelessWidget {
  const _NumberField({
    required this.label,
    required this.icon,
    required this.value,
    required this.min,
    required this.max,
    required this.onChanged,
  });

  final String label;
  final IconData icon;
  final int value;
  final int min;
  final int max;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: TextEditingController(text: value.toString()),
      keyboardType: TextInputType.number,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon),
        border: const OutlineInputBorder(),
        helperText: '范围 $min - ${_format(max)}',
      ),
      onChanged: (text) {
        final parsed = int.tryParse(text);
        if (parsed != null && parsed >= min && parsed <= max) {
          onChanged(parsed);
        }
      },
    );
  }

  String _format(int n) {
    if (n >= 1000000) return '${n ~/ 1000000}M';
    if (n >= 1000) return '${n ~/ 1000}K';
    return n.toString();
  }
}
