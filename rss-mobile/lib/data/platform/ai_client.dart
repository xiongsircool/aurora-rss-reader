import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

/// Full AI service configuration with all tunable parameters.
class AiConfig {
  const AiConfig({
    required this.baseUrl,
    required this.apiKey,
    required this.model,
    this.language = 'zh',
    this.maxTokens = 2048,
    this.temperature = 0.7,
    this.topP,
    this.timeoutSeconds = 60,
    this.maxRetries = 2,
    this.systemPromptOverride,
  });

  final String baseUrl;
  final String apiKey;
  final String model;
  final String language;
  final int maxTokens;
  final double temperature;
  final double? topP;
  final int timeoutSeconds;
  final int maxRetries;
  final String? systemPromptOverride;

  bool get isConfigured => baseUrl.isNotEmpty && apiKey.isNotEmpty;

  Map<String, dynamic> toRequestPayload({
    required String systemPrompt,
    required String userContent,
  }) => {
    'model': model,
    'stream': true,
    'max_tokens': maxTokens,
    'temperature': temperature,
    if (topP != null) 'top_p': topP,
    'messages': [
      {'role': 'system', 'content': systemPromptOverride ?? systemPrompt},
      {'role': 'user', 'content': userContent},
    ],
  };
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

/// Calls an OpenAI-compatible `/chat/completions` endpoint with streaming,
/// timeout, and automatic retry on rate-limit/server errors.
class AiClient {
  AiClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Stream<AiStreamEvent> summarize({
    required AiConfig config,
    required String systemPrompt,
    required String userContent,
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

    for (var attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        final request = http.Request('POST', uri)
          ..headers.addAll({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ${config.apiKey}',
          });
        request.body = jsonEncode(
          config.toRequestPayload(
            systemPrompt: systemPrompt,
            userContent: userContent,
          ),
        );

        final response = await _client
            .send(request)
            .timeout(Duration(seconds: config.timeoutSeconds));

        // Retry on rate limit or server errors.
        if (response.statusCode == 429 || response.statusCode >= 500) {
          if (attempt < config.maxRetries) {
            await Future.delayed(Duration(seconds: attempt + 1));
            continue;
          }
        }

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
        return;
      } on http.ClientException catch (e) {
        if (attempt >= config.maxRetries) {
          yield AiError('网络错误：${e.message}');
          return;
        }
        await Future.delayed(Duration(seconds: attempt + 1));
      } on TimeoutException {
        if (attempt >= config.maxRetries) {
          yield const AiError('AI 请求超时');
          return;
        }
        await Future.delayed(Duration(seconds: attempt + 1));
      }
    }
  }

  void close() {
    _client.close();
  }
}
