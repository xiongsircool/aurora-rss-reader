import 'package:flutter/material.dart';

class ChoiceOption<T> {
  const ChoiceOption({
    required this.value,
    required this.title,
    this.subtitle,
    this.leading,
  });
  final T value;
  final String title;
  final String? subtitle;
  final Widget? leading;
}

/// A cancellable single-selection sheet. Values are applied only by the
/// confirmation button; an async failure leaves the choices open for retry.
Future<T?> showChoiceSheet<T>({
  required BuildContext context,
  required String title,
  required T selected,
  required List<ChoiceOption<T>> options,
  String? description,
  String confirmLabel = '应用',
  Future<void> Function(T)? onApply,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => _ChoiceSheet<T>(
      title: title,
      selected: selected,
      options: options,
      description: description,
      confirmLabel: confirmLabel,
      onApply: onApply,
    ),
  );
}

class _ChoiceSheet<T> extends StatefulWidget {
  const _ChoiceSheet({
    required this.title,
    required this.selected,
    required this.options,
    required this.confirmLabel,
    this.description,
    this.onApply,
  });
  final String title;
  final T selected;
  final List<ChoiceOption<T>> options;
  final String? description;
  final String confirmLabel;
  final Future<void> Function(T)? onApply;
  @override
  State<_ChoiceSheet<T>> createState() => _ChoiceSheetState<T>();
}

class _ChoiceSheetState<T> extends State<_ChoiceSheet<T>> {
  late T _value = widget.selected;
  bool _saving = false;
  String? _error;
  final _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _apply() async {
    if (_saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.onApply?.call(_value);
      if (mounted) Navigator.pop(context, _value);
    } catch (_) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = '设置未能应用，请稍后重试。原设置已保留。';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !_saving,
    child: SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * 0.8,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                child: Text(
                  widget.title,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              if (widget.description != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
                  child: Text(
                    widget.description!,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
              Flexible(
                child: Scrollbar(
                  controller: _scroll,
                  thumbVisibility: true,
                  interactive: true,
                  child: ListView.builder(
                    controller: _scroll,
                    shrinkWrap: true,
                    itemCount: widget.options.length,
                    itemBuilder: (context, i) {
                      final option = widget.options[i];
                      final checked = option.value == _value;
                      return Semantics(
                        selected: checked,
                        child: ListTile(
                          leading: option.leading,
                          title: Text(option.title),
                          subtitle: option.subtitle == null
                              ? null
                              : Text(option.subtitle!),
                          selected: checked,
                          trailing: Icon(
                            checked
                                ? Icons.check_circle
                                : Icons.radio_button_unchecked,
                            color: checked
                                ? Theme.of(context).colorScheme.primary
                                : Theme.of(context).colorScheme.outline,
                          ),
                          onTap: _saving
                              ? null
                              : () => setState(() {
                                  _value = option.value;
                                  _error = null;
                                }),
                        ),
                      );
                    },
                  ),
                ),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                  child: Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Expanded(
                      child: TextButton(
                        onPressed: _saving
                            ? null
                            : () => Navigator.pop(context),
                        child: const Text('取消'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: _saving ? null : _apply,
                        child: _saving
                            ? const SizedBox.square(
                                dimension: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Text(widget.confirmLabel),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
