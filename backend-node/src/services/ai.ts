/**
 * AI Client for translation and summarization
 * Using OpenAI SDK for better compatibility and error handling
 */

import OpenAI from 'openai';

export type ServiceKey = 'summary' | 'translation' | 'embedding' | 'tagging';

export class AIClient {
  private client: OpenAI | null = null;
  private baseUrl: string;
  private model: string;
  private apiKey: string;

  constructor(options: { baseUrl?: string; model?: string; apiKey?: string } = {}) {
    this.baseUrl = options.baseUrl ? options.baseUrl.replace(/\/$/, '') : '';
    this.model = options.model || '';
    this.apiKey = options.apiKey || '';

    // Initialize client if credentials are provided
    if (this.baseUrl && this.apiKey) {
      this.initializeClient();
    }
  }

  private initializeClient(): void {
    this.client = new OpenAI({
      baseURL: this.baseUrl,
      apiKey: this.apiKey,
      timeout: 90000, // 90 seconds timeout
      maxRetries: 2, // Automatic retry on failure
    });
  }

  configure(options: { baseUrl?: string; model?: string; apiKey?: string }): void {
    let needsReinit = false;

    if (options.baseUrl !== undefined) {
      this.baseUrl = options.baseUrl ? options.baseUrl.replace(/\/$/, '') : '';
      needsReinit = true;
    }
    if (options.model !== undefined) {
      this.model = options.model;
    }
    if (options.apiKey !== undefined) {
      this.apiKey = options.apiKey;
      needsReinit = true;
    }

    // Reinitialize client if baseUrl or apiKey changed
    if (needsReinit && this.baseUrl && this.apiKey) {
      this.initializeClient();
    }
  }

  snapshot(): { baseUrl: string; model: string; apiKey: string } {
    return {
      baseUrl: this.baseUrl,
      model: this.model,
      apiKey: this.apiKey,
    };
  }

  private ensureReady(): void {
    if (!this.apiKey) {
      throw new Error('API Key 未配置');
    }
    if (!this.baseUrl) {
      throw new Error('API Base URL 未配置');
    }
    if (!this.model) {
      throw new Error('Model 未配置');
    }
    if (!this.client) {
      this.initializeClient();
    }
  }

  async chat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: { maxTokens?: number; temperature?: number } = {}
  ): Promise<string> {
    this.ensureReady();

    try {
      const completion = await this.client!.chat.completions.create({
        model: this.model,
        messages,
        max_tokens: options.maxTokens ?? 800,
        temperature: options.temperature ?? 0.3,
      });

      const message = completion.choices[0]?.message?.content || '';
      return message.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new Error(`AI API 错误 (${error.status}): ${error.message}`);
      }
      throw error;
    }
  }

  async summarize(content: string, options: { language?: string; userPreference?: string } = {}): Promise<string> {
    this.ensureReady();

    const language = options.language || 'zh';
    const userPreference = options.userPreference?.trim() || '';
    const maxInputLength = 8000;

    if (content.length > maxInputLength) {
      content = content.substring(0, maxInputLength) + '...';
    }

    const languageNames: Record<string, string> = {
      zh: '中文',
      en: 'English',
      ja: '日本語',
      ko: '한국어',
      fr: 'Français',
      de: 'Deutsch',
      es: 'Español',
    };
    const langDisplay = languageNames[language] || language;

    // Build system prompt with optional user preference
    let systemPrompt = `你是一个专业的RSS阅读器助手。你会收到一段文章文本，其中开头部分可能包含文章的标题、作者、时间等元信息，之后是正文内容。请用${langDisplay}对整体内容生成全面而精炼的摘要。摘要应该：\n1. 抓住文章的核心观点和主要论据\n2. 包含重要的细节和支撑数据\n3. 保持逻辑结构清晰，层次分明\n4. 适当保持原文的风格和语调\n5. 控制长度在合理范围内，确保信息密度`;

    if (userPreference) {
      systemPrompt += `\n\n用户额外要求：${userPreference}`;
    }

    try {
      const completion = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          { role: 'user', content },
        ],
        max_tokens: 1000,
      });

      const message = completion.choices[0]?.message?.content || '';
      
      // Remove <think> tags if present (some models include reasoning process)
      return message.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new Error(`AI API 错误 (${error.status}): ${error.message}`);
      }
      throw error;
    }
  }

  async translate(text: string, options: { targetLanguage?: string; userPreference?: string } = {}): Promise<string> {
    this.ensureReady();

    const targetLanguage = options.targetLanguage || 'zh';
    const userPreference = options.userPreference?.trim() || '';

    const languageNames: Record<string, string> = {
      zh: '中文',
      en: 'English',
      ja: '日本語',
      ko: '한국어',
      fr: 'Français',
      de: 'Deutsch',
      es: 'Español',
    };
    const langDisplay = languageNames[targetLanguage] || targetLanguage;

    // Build system prompt with optional user preference
    let systemPrompt = `你是专业翻译助手。请将以下文本翻译为${langDisplay}，保持 Markdown 格式和 HTML 标签不变，只翻译文本内容。`;

    if (userPreference) {
      systemPrompt += `\n\n用户额外要求：${userPreference}`;
    }

    try {
      const completion = await this.client!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          { role: 'user', content: text },
        ],
        max_tokens: 2048,
      });

      const message = completion.choices[0]?.message?.content || '';
      
      // Remove <think> tags if present
      return message.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new Error(`AI API 错误 (${error.status}): ${error.message}`);
      }
      throw error;
    }
  }
}

// Global AI client instance
export const glmClient = new AIClient();
