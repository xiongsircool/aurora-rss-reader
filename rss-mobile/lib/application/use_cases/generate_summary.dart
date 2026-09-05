import 'dart:async';

import 'package:html/parser.dart' as html_parser;

import '../../data/platform/ai_client.dart';
import '../../data/repositories/local_content_repository.dart';

/// Generates an AI summary for a single article using an OpenAI-compatible
/// streaming endpoint. Results are cached in the local database.
class GenerateSummary {
  GenerateSummary({required this.repository, required this.client});

  final LocalContentRepository repository;
  final AiClient client;

  String? _cachedResult;

  String? get cachedResult => _cachedResult;

  Future<String?> loadCached(String entryId, String language) {
    return repository.loadSummary(entryId: entryId, language: language);
  }

  Stream<String> call({
    required String entryId,
    required String title,
    required String contentHtml,
    required AiConfig config,
  }) async* {
    // Check cache first.
    final cached = await repository.loadSummary(
      entryId: entryId,
      language: config.language,
    );
    if (cached != null) {
      yield cached;
      return;
    }

    // Strip HTML to plain text for the AI prompt.
    final plainText = html_parser.parseFragment(contentHtml).text?.trim() ?? '';
    if (plainText.length < 30) {
      yield '';
      return;
    }

    // Truncate very long articles to ~8K characters to save tokens.
    final content = plainText.length > 8000
        ? '${plainText.substring(0, 8000)}...'
        : plainText;

    final buffer = StringBuffer();
    await for (final event in client.summarize(
      config: config,
      systemPrompt:
          'You are a helpful assistant. Summarize the following '
          'article in ${config.language == 'zh' ? 'Chinese' : 'the same '
                    'language as the article'}. Return a concise summary in 2-4 '
          'sentences. Do not add any preamble like "Here is the summary".',
      userContent: content,
    )) {
      switch (event) {
        case AiDelta(:final text):
          buffer.write(text);
          yield buffer.toString();
        case AiError(:final message):
          throw Exception(message);
        case AiDone():
          break;
      }
    }

    final result = buffer.toString().trim();
    if (result.isNotEmpty) {
      await repository.saveSummary(
        entryId: entryId,
        language: config.language,
        summary: result,
      );
      _cachedResult = result;
    }
  }
}
