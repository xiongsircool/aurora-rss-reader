/**
 * AI Tagging Service
 * Analyzes article content and returns matching tags
 */

import { AIClient } from './ai.js';
import { UserTag } from '../db/models.js';
import { getDatabase } from '../db/session.js';
import { UserSettings } from '../db/models.js';

// Dedicated tagging client (can have separate config from summary/translation)
export const taggingClient = new AIClient();

export interface TaggingResult {
    success: boolean;
    tagIds: string[];
    error?: string;
}

export interface TaggingContent {
    title: string;
    summary?: string | null;
    content?: string | null;
}

/**
 * Initialize tagging client from user settings
 * Uses custom tagging config if enabled, otherwise falls back to global default
 */
export function initTaggingClient(): void {
    const db = getDatabase();
    const settings = db.prepare('SELECT * FROM user_settings WHERE id = 1').get() as UserSettings | undefined;

    if (!settings) return;

    let apiKey: string;
    let baseUrl: string;
    let modelName: string;

    if (settings.tagging_use_custom === 1) {
        // Use tagging-specific config
        apiKey = settings.tagging_api_key || '';
        baseUrl = settings.tagging_base_url || '';
        modelName = settings.tagging_model_name || '';
    } else {
        // Use global default config
        apiKey = settings.default_ai_api_key || '';
        baseUrl = settings.default_ai_base_url || '';
        modelName = settings.default_ai_model || '';
    }

    if (apiKey && baseUrl && modelName) {
        taggingClient.configure({
            apiKey,
            baseUrl,
            model: modelName,
        });
    }
}

/**
 * Analyze article content and return matching tag names
 */
export async function analyzeEntryTags(
    content: TaggingContent,
    availableTags: UserTag[]
): Promise<TaggingResult> {
    if (availableTags.length === 0) {
        return { success: true, tagIds: [] };
    }

    // Build tag list with descriptions for AI context
    const tagList = availableTags
        .map((tag) => {
            const desc = tag.description ? ` | description=${tag.description}` : '';
            return `- id=${tag.id} | name=${tag.name}${desc}`;
        })
        .join('\n');

    // Build article content preview
    const articleContent = buildArticleContent(content);

    const systemPrompt = `你是一个专业的文章分类助手。根据用户定义的标签列表和文章内容，判断文章属于哪些标签分类。

用户定义的标签列表：
${tagList}

规则：
1. 只返回与文章内容相关的标签 id
2. 一篇文章可以匹配多个标签，也可以不匹配任何标签
3. 只能从上述标签列表中选择，不要自创标签
4. 返回格式必须是 JSON 数组，只包含标签 id 字符串
5. 除了 JSON 数组外，不要输出任何解释性文字

返回格式示例：
["tag_id_1", "tag_id_2"]

如果没有匹配的标签，返回空数组：
[]`;

    const userPrompt = `请分析以下文章，返回匹配的标签 id（JSON数组格式）：

${articleContent}`;

    try {
        const message = await taggingClient.chat(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            {
                maxTokens: 300,
                temperature: 0.2,
            }
        );

        // Clean up response and parse JSON
        const cleanedMessage = (message || '[]')
            .replace(/```json\s*/g, '')
            .replace(/```\s*/g, '')
            .trim();

        const tagIds = parseTagIdsFromResponse(cleanedMessage, availableTags);

        return { success: true, tagIds };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Tagging analysis error:', errorMessage);
        return { success: false, tagIds: [], error: errorMessage };
    }
}

/**
 * Build article content for analysis
 */
function buildArticleContent(content: TaggingContent): string {
    const MAX_TOTAL_LENGTH = 500;  // Total length limit
    const MAX_TITLE_LENGTH = 100;   // Title max 100 chars
    const MAX_SUMMARY_LENGTH = 150; // Summary max 150 chars
    const MAX_CONTENT_LENGTH = 250; // Content max 250 chars

    const parts: string[] = [];

    // 1. Title (limit 100 chars)
    let title = content.title || '';
    if (title.length > MAX_TITLE_LENGTH) {
        title = title.substring(0, MAX_TITLE_LENGTH) + '...';
    }
    parts.push(`标题: ${title}`);

    // 2. Summary (limit 150 chars)
    if (content.summary) {
        let summary = content.summary;
        if (summary.length > MAX_SUMMARY_LENGTH) {
            summary = summary.substring(0, MAX_SUMMARY_LENGTH) + '...';
        }
        parts.push(`摘要: ${summary}`);
    }

    // 3. Content preview (limit 250 chars)
    if (content.content) {
        let articleBody = content.content
            .replace(/<[^>]+>/g, ' ') // Remove HTML tags
            .replace(/\s+/g, ' ')     // Normalize whitespace
            .trim();

        if (articleBody.length > MAX_CONTENT_LENGTH) {
            articleBody = articleBody.substring(0, MAX_CONTENT_LENGTH) + '...';
        }

        if (articleBody) {
            parts.push(`正文预览: ${articleBody}`);
        }
    }

    // 4. Ensure total length does not exceed 500 chars
    let result = parts.join('\n\n');
    if (result.length > MAX_TOTAL_LENGTH) {
        result = result.substring(0, MAX_TOTAL_LENGTH) + '...';
    }

    return result;
}

/**
 * Parse tag ids from AI response
 */
function parseTagIdsFromResponse(
    response: string,
    availableTags: UserTag[]
): string[] {
    try {
        const parsed = JSON.parse(response);

        if (!Array.isArray(parsed)) {
            return [];
        }

        const validIds = new Set(availableTags.map((t) => t.id));
        const seen = new Set<string>();
        const result: string[] = [];

        for (const tagId of parsed) {
            if (typeof tagId !== 'string') continue;
            if (!validIds.has(tagId)) continue;
            if (seen.has(tagId)) continue;
            seen.add(tagId);
            result.push(tagId);
        }

        return result;
    } catch {
        return [];
    }
}

/**
 * Get tagging configuration
 */
export function getTaggingConfig(): {
    apiKey: string;
    baseUrl: string;
    modelName: string;
    autoTagging: boolean;
    autoTaggingStartAt: string | null;
    tagsVersion: number;
} {
    const db = getDatabase();
    const settings = db.prepare('SELECT * FROM user_settings WHERE id = 1').get() as UserSettings | undefined;

    if (!settings) {
        return {
            apiKey: '',
            baseUrl: '',
            modelName: '',
            autoTagging: false,
            autoTaggingStartAt: null,
            tagsVersion: 1,
        };
    }

    let apiKey: string;
    let baseUrl: string;
    let modelName: string;

    if (settings.tagging_use_custom === 1) {
        apiKey = settings.tagging_api_key || '';
        baseUrl = settings.tagging_base_url || '';
        modelName = settings.tagging_model_name || '';
    } else {
        apiKey = settings.default_ai_api_key || '';
        baseUrl = settings.default_ai_base_url || '';
        modelName = settings.default_ai_model || '';
    }

    return {
        apiKey,
        baseUrl,
        modelName,
        autoTagging: settings.ai_auto_tagging === 1,
        autoTaggingStartAt: settings.ai_auto_tagging_start_at || null,
        tagsVersion: settings.tags_version || 1,
    };
}

/**
 * Update tagging configuration
 */
export function updateTaggingConfig(config: {
    apiKey?: string;
    baseUrl?: string;
    modelName?: string;
    autoTagging?: boolean;
}): void {
    const db = getDatabase();
    const updates: string[] = [];
    const values: (string | number)[] = [];
    const now = new Date().toISOString();

    if (config.apiKey !== undefined) {
        updates.push('tagging_api_key = ?');
        values.push(config.apiKey);
    }
    if (config.baseUrl !== undefined) {
        updates.push('tagging_base_url = ?');
        values.push(config.baseUrl);
    }
    if (config.modelName !== undefined) {
        updates.push('tagging_model_name = ?');
        values.push(config.modelName);
    }
    if (config.autoTagging !== undefined) {
        const current = db.prepare('SELECT ai_auto_tagging FROM user_settings WHERE id = 1').get() as
            | { ai_auto_tagging: number }
            | undefined;
        const nextValue = config.autoTagging ? 1 : 0;

        updates.push('ai_auto_tagging = ?');
        values.push(nextValue);

        if (nextValue === 1 && current?.ai_auto_tagging !== 1) {
            // Record when auto-tagging was enabled so we don't process historical entries by default.
            updates.push('ai_auto_tagging_start_at = ?');
            values.push(now);
        }
    }

    if (updates.length > 0) {
        updates.push('updated_at = ?');
        values.push(now);

        const stmt = db.prepare(`UPDATE user_settings SET ${updates.join(', ')} WHERE id = 1`);
        stmt.run(...values);

        // Reinitialize client with new config
        initTaggingClient();
    }
}

/**
 * Increment tags version (used when tags are created/modified)
 */
export function incrementTagsVersion(): number {
    const db = getDatabase();
    db.prepare('UPDATE user_settings SET tags_version = tags_version + 1, updated_at = ? WHERE id = 1')
        .run(new Date().toISOString());

    const result = db.prepare('SELECT tags_version FROM user_settings WHERE id = 1').get() as { tags_version: number };
    return result.tags_version;
}
