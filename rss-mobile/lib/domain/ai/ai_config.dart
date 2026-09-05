/// Full AI service configuration modelled after pi's provider/model system.
///
/// Supports multiple providers, per-model settings, sampling parameters,
/// and compatibility flags for non-standard OpenAI-compatible endpoints.
library;

/// A single AI model configuration within a provider.
class AiModelConfig {
  const AiModelConfig({
    required this.id,
    this.name,
    this.reasoning = false,
    this.maxTokens = 16384,
    this.contextWindow = 128000,
    this.inputTypes = const ['text'],
    this.samplingParams = const {},
    this.maxTokensField = 'max_tokens',
    this.supportsReasoningEffort = true,
    this.thinkingFormat,
  });

  /// Model identifier sent to the API (e.g. "deepseek-ai/DeepSeek-V3").
  final String id;

  /// Human-readable display name.
  final String? name;

  /// Whether the model supports extended thinking/reasoning.
  final bool reasoning;

  /// Maximum output tokens for this model.
  final int maxTokens;

  /// Context window size in tokens.
  final int contextWindow;

  /// Supported input types: "text", "image".
  final List<String> inputTypes;

  /// Free-form sampling parameters merged into every request.
  /// Keys override the request-level fields.
  final Map<String, dynamic> samplingParams;

  /// Which field name to use for max tokens in the request.
  /// Some APIs use "max_tokens", others "max_output_tokens".
  final String maxTokensField;

  /// Whether the endpoint supports the reasoning_effort parameter.
  final bool supportsReasoningEffort;

  /// Format for thinking/reasoning content (e.g. "deepseek", "openai").
  final String? thinkingFormat;

  String get displayName => name ?? id;

  Map<String, dynamic> mergeSampling(Map<String, dynamic> base) {
    return {...base, ...samplingParams};
  }

  factory AiModelConfig.fromJson(Map<String, dynamic> json) => AiModelConfig(
    id: json['id'] as String,
    name: json['name'] as String?,
    reasoning: json['reasoning'] as bool? ?? false,
    maxTokens: json['maxTokens'] as int? ?? 16384,
    contextWindow: json['contextWindow'] as int? ?? 128000,
    inputTypes:
        (json['inputTypes'] as List?)?.map((e) => e as String).toList() ??
        const ['text'],
    maxTokensField: json['maxTokensField'] as String? ?? 'max_tokens',
    supportsReasoningEffort: json['supportsReasoningEffort'] as bool? ?? true,
    thinkingFormat: json['thinkingFormat'] as String?,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    if (name != null) 'name': name,
    'reasoning': reasoning,
    'maxTokens': maxTokens,
    'contextWindow': contextWindow,
    'inputTypes': inputTypes,
    'maxTokensField': maxTokensField,
    'supportsReasoningEffort': supportsReasoningEffort,
    if (thinkingFormat != null) 'thinkingFormat': thinkingFormat,
  };
}

/// A provider configuration with endpoint and model list.
class AiProviderConfig {
  const AiProviderConfig({
    required this.id,
    required this.baseUrl,
    required this.models,
    this.name,
    this.apiType = 'openai-completions',
    this.headers = const {},
  });

  /// Unique provider identifier (e.g. "siliconflow", "deepseek", "local").
  final String id;

  /// Display name.
  final String? name;

  /// API base URL (e.g. "https://api.siliconflow.cn/v1").
  final String baseUrl;

  /// API protocol type; currently only "openai-completions" is used.
  final String apiType;

  /// Additional headers to send with every request.
  final Map<String, String> headers;

  /// Available models under this provider.
  final List<AiModelConfig> models;

  String get displayName => name ?? id;

  factory AiProviderConfig.fromJson(Map<String, dynamic> json) =>
      AiProviderConfig(
        id: json['id'] as String,
        baseUrl: json['baseUrl'] as String,
        name: json['name'] as String?,
        apiType: json['apiType'] as String? ?? 'openai-completions',
        headers:
            (json['headers'] as Map<String, dynamic>?)?.map(
              (k, v) => MapEntry(k, v as String),
            ) ??
            const {},
        models:
            (json['models'] as List?)
                ?.map((m) => AiModelConfig.fromJson(m as Map<String, dynamic>))
                .toList() ??
            [],
      );

  Map<String, dynamic> toJson() => {
    'id': id,
    'baseUrl': baseUrl,
    if (name != null) 'name': name,
    'apiType': apiType,
    if (headers.isNotEmpty) 'headers': headers,
    'models': models.map((m) => m.toJson()).toList(),
  };
}

/// Resolved configuration for a single AI request, combining provider
/// endpoint, model settings, API key, and user preferences.
class AiRequestConfig {
  const AiRequestConfig({
    required this.baseUrl,
    required this.apiKey,
    required this.model,
    this.temperature = 0.7,
    this.topP,
    this.maxTokens,
    this.timeoutSeconds = 60,
    this.maxRetries = 2,
    this.language = 'zh',
    this.systemPromptOverride,
    this.customHeaders = const {},
    this.maxTokensField = 'max_tokens',
    this.supportsReasoningEffort = true,
    this.samplingParams = const {},
  });

  final String baseUrl;
  final String apiKey;
  final AiModelConfig model;
  final double temperature;
  final double? topP;
  final int? maxTokens;
  final int timeoutSeconds;
  final int maxRetries;
  final String language;
  final String? systemPromptOverride;
  final Map<String, String> customHeaders;
  final String maxTokensField;
  final bool supportsReasoningEffort;
  final Map<String, dynamic> samplingParams;

  bool get isConfigured =>
      baseUrl.isNotEmpty && apiKey.isNotEmpty && model.id.isNotEmpty;

  int get effectiveMaxTokens => maxTokens ?? model.maxTokens;

  /// Builds the full request body with sampling params merged last.
  Map<String, dynamic> toRequestBody({
    required String systemPrompt,
    required String userContent,
  }) {
    final body = <String, dynamic>{
      'model': model.id,
      'stream': true,
      maxTokensField: effectiveMaxTokens,
      'temperature': temperature,
      if (topP != null) 'top_p': topP,
      'messages': [
        {'role': 'system', 'content': systemPromptOverride ?? systemPrompt},
        {'role': 'user', 'content': userContent},
      ],
    };
    // Merge model-level sampling params last so they override.
    return model.mergeSampling(body);
  }
}
