import 'package:flutter/material.dart';

const String defaultGroupName = 'default';

String groupDisplayName(String name) => name == defaultGroupName ? '未分组' : name;

/// Displays a group picker and returns the chosen group name, or null when
/// cancelled. Existing groups are offered as radio options plus a
/// "new group" entry with a text field.
Future<String?> showGroupPicker(
  BuildContext context, {
  required Set<String> existingGroups,
  String? current,
}) {
  return showDialog<String>(
    context: context,
    builder: (_) =>
        _GroupPickerDialog(existingGroups: existingGroups, current: current),
  );
}

final class _GroupPickerDialog extends StatefulWidget {
  const _GroupPickerDialog({required this.existingGroups, this.current});

  final Set<String> existingGroups;
  final String? current;

  @override
  State<_GroupPickerDialog> createState() => _GroupPickerDialogState();
}

class _GroupPickerDialogState extends State<_GroupPickerDialog> {
  late String? _selected;
  bool _creating = false;
  final _newGroupController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _selected = widget.current;
  }

  @override
  void dispose() {
    _newGroupController.dispose();
    super.dispose();
  }

  void _submit() {
    if (_creating) {
      final name = _newGroupController.text.trim();
      if (name.isEmpty) return;
      Navigator.of(context).pop(name);
      return;
    }
    final selected = _selected;
    if (selected == null) return;
    Navigator.of(context).pop(selected);
  }

  @override
  Widget build(BuildContext context) {
    final groups = <String>{...widget.existingGroups, defaultGroupName}.toList()
      ..sort();
    return AlertDialog(
      title: const Text('选择分组'),
      content: SingleChildScrollView(
        child: RadioGroup<String>(
          groupValue: _creating ? '__new__' : _selected,
          onChanged: (value) => setState(() {
            _creating = value == '__new__';
            _selected = _creating ? null : value;
          }),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final group in groups)
                RadioListTile<String>(
                  value: group,
                  title: Text(groupDisplayName(group)),
                ),
              RadioListTile<String>(
                value: '__new__',
                title: _creating
                    ? TextField(
                        key: const ValueKey('new-group-input'),
                        controller: _newGroupController,
                        autofocus: true,
                        decoration: const InputDecoration(labelText: '新分组名称'),
                        onSubmitted: (_) => _submit(),
                      )
                    : const Text('新建分组…'),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('取消'),
        ),
        FilledButton(
          key: const ValueKey('group-select-submit'),
          onPressed: _submit,
          child: const Text('确定'),
        ),
      ],
    );
  }
}
