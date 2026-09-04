import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

final class AiConfig {
  const AiConfig({
    required this.baseUrl,
    required this.apiKey,
    required this.model,
    this.language = 'zh',
  });

  final String baseUrl;
  final String apiKey;
  final String model;
  final String language;

  bool get isConfigured => baseUrl.isNotEmpty && apiKey.isNotEmpty;
}

sealed class AiStreamEvent {
  const AiStreamEvent();
}

final class AiDelta extends AiStreamEvent {
  const AiDelta(this.text);
  final String text;
}

final class AiDone extends AiStreamEvent {
  const AiDone();
}

final class AiError extends AiStreamEvent {
  const AiError(this.message);
  final String message;
}

/// Calls an OpenAI-compatible `/chat/completions` endpoint with streaming.
class AiClient {
  AiClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  /// Streams an AI response for the given system prompt and user content.
  /// Returns a stream of [AiStreamEvent]. The caller is responsible for
  /// cancelling the subscription to abort early.
  Stream<AiStreamEvent> summarize({
    required AiConfig config,
    required String systemPrompt,
    required String userContent,
    int maxTokens = 2048,
  }) async* {
    if (!config.isConfigured) {
      yield const AiError('AI 未配置');
      return;
    }

    final uri = Uri.parse(
      config.baseUrl.endsWith('/')
          ? '${config.baseUrl}chat/completions'
          : '${config.baseUrl}/chat/completions',
    );

    try {
      final request = http.Request('POST', uri)
        ..headers.addAll({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${config.apiKey}',
        });
      request.body = jsonEncode({
        'model': config.model,
        'stream': true,
        'max_tokens': maxTokens,
        'messages': [
          {'role': 'system', 'content': systemPrompt},
          {'role': 'user', 'content': userContent},
        ],
      });

      final response = await _client
          .send(request)
          .timeout(const Duration(seconds: 60));

      if (response.statusCode != 200) {
        final body = await response.stream.bytesToString();
        yield AiError('HTTP ${response.statusCode}: $body');
        return;
      }

      final lineRegex = RegExp(r'^data:\s*(.+)$');
      await for (final line
          in response.stream
              .transform(const Utf8Decoder())
              .transform(const LineSplitter())) {
        final trimmed = line.trim();
        if (trimmed.isEmpty || !trimmed.startsWith('data:')) continue;
        final match = lineRegex.firstMatch(trimmed);
        if (match == null) continue;
        final payload = match.group(1)!;
        if (payload == '[DONE]') {
          yield const AiDone();
          return;
        }
        try {
          final json = jsonDecode(payload) as Map<String, dynamic>;
          final choices = json['choices'] as List?;
          if (choices == null || choices.isEmpty) continue;
          final delta = choices[0]['delta'] as Map<String, dynamic>?;
          final content = delta?['content'] as String?;
          if (content != null && content.isNotEmpty) {
            yield AiDelta(content);
          }
        } on FormatException {
          continue;
        }
      }
      yield const AiDone();
    } on http.ClientException catch (e) {
      yield AiError('网络错误：${e.message}');
    }
  }

  void close() {
    _client.close();
  }
}
