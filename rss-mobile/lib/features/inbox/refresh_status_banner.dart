import 'package:flutter/material.dart';

import '../reader/mobile_reader_controller.dart';

class RefreshStatusBanner extends StatelessWidget {
  const RefreshStatusBanner({required this.controller, super.key});
  final MobileReaderController controller;

  void _details(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => AnimatedBuilder(
        animation: controller,
        builder: (context, _) {
          final failures = controller.refreshFailures;
          return SafeArea(
            child: SizedBox(
              height: MediaQuery.sizeOf(context).height * 0.65,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 8,
                    ),
                    child: Text(
                      '刷新详情',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  if (controller.refreshing)
                    const LinearProgressIndicator(minHeight: 2),
                  Expanded(
                    child: failures.isEmpty
                        ? const Center(child: Text('没有需要重试的订阅'))
                        : ListView.separated(
                            itemCount: failures.length,
                            separatorBuilder: (_, _) => const Divider(
                              height: 1,
                              indent: 20,
                              endIndent: 20,
                            ),
                            itemBuilder: (context, i) {
                              final failure = failures[i];
                              return ListTile(
                                title: Text(failure.title),
                                subtitle: Text(failure.error),
                                trailing: IconButton(
                                  tooltip: '重试 ${failure.title}',
                                  onPressed: controller.refreshing
                                      ? null
                                      : () => controller.retryFailedRefreshes(
                                          feedId: failure.feedId,
                                        ),
                                  icon: const Icon(Icons.refresh),
                                ),
                              );
                            },
                          ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: FilledButton.tonalIcon(
                      onPressed: controller.refreshing || failures.isEmpty
                          ? null
                          : controller.retryFailedRefreshes,
                      icon: const Icon(Icons.refresh),
                      label: const Text('重试失败的订阅'),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final failures = controller.refreshFailures;
    final message = controller.refreshing
        ? '正在刷新 ${controller.refreshCompleted}/${controller.refreshTotal}'
        : controller.error ?? controller.notice;
    if (message == null) return const SizedBox.shrink();
    final scheme = Theme.of(context).colorScheme;
    final color = controller.error != null ? scheme.error : scheme.secondary;
    return Material(
      color: color.withValues(alpha: 0.06),
      child: Padding(
        padding: const EdgeInsets.only(left: 16, right: 4),
        child: Row(
          children: [
            Icon(
              controller.refreshing
                  ? Icons.sync
                  : failures.isNotEmpty
                  ? Icons.info_outline
                  : Icons.check_circle_outline,
              color: color,
              size: 18,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                message,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall
                    ?.copyWith(color: color),
              ),
            ),
            if (failures.isNotEmpty)
              TextButton(
                onPressed: () => _details(context),
                child: const Text('查看'),
              ),
            IconButton(
              tooltip: '关闭',
              onPressed: controller.refreshing
                  ? null
                  : controller.clearMessages,
              icon: const Icon(Icons.close, size: 18),
            ),
          ],
        ),
      ),
    );
  }
}
