# Embedding 重建功能 - 完整实现方案

## 修改文件 1: backend-node/src/services/vector.ts

### 关键优化点
1. **仅使用 title 进行 embedding** - 从原来的 title+summary+content 改为只用 title
2. **批量 API 调用** - 使用 OpenAI 的批量 embeddings 接口，一次处理多个 title
3. **性能提升** - 批量大小设为 100，理论性能提升 50-100 倍

### 需要修改的函数

#### 1. generateEmbedding() - 保持不变（单个文本）
```typescript
// 保持原有实现，用于单个 entry 的增量 embedding
```

#### 2. 新增 generateEmbeddingsBatch() - 批量生成
```typescript
/**
 * Generate embeddings for multiple texts in batch
 * @param texts Array of texts to embed
 * @returns Array of embeddings (same order as input)
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<(number[] | null)[]> {
    try {
        const client = await getOpenAIClient();
        if (!client) return texts.map(() => null);

        const settings = userSettingsService.getSettings();
        if (texts.length === 0) return [];

        // Filter and truncate texts
        const processedTexts = texts.map(text => {
            if (!text || text.trim().length === 0) return "";
            return text.substring(0, 500); // Limit title length
        });

        // Call batch embedding API
        const response = await client.embeddings.create({
            model: settings.embedding_model,
            input: processedTexts,
            encoding_format: "float",
        });

        // Extract embeddings in order
        return response.data.map(item => item.embedding);
    } catch (error) {
        console.error("[Vector] Error generating batch embeddings:", error);
        return texts.map(() => null);
    }
}
```

#### 3. 修改 syncEntriesToVectorDB() - 使用 title + 批量
```typescript
/**
 * Sync un-vectorized entries to Vector DB (using title only + batch API)
 * @param limit Max number of entries to process in this batch
 */
export async function syncEntriesToVectorDB(limit: number = 100): Promise<number> {
    const db = getDatabase();

    // Get entries that don't have vectors yet
    const entries = db.prepare(`
        SELECT e.id, e.title, e.feed_id, e.published_at, e.url
        FROM entries e
        LEFT JOIN rss_vectors v ON e.id = v.entry_id
        WHERE v.entry_id IS NULL
        AND e.title IS NOT NULL
        AND length(e.title) > 0
        ORDER BY e.inserted_at DESC
        LIMIT ?
    `).all(limit) as any[];

    if (entries.length === 0) {
        return 0;
    }

    console.log(`[Vector] Processing ${entries.length} new entries with batch API...`);

    // Extract titles for batch processing
    const titles = entries.map(e => e.title || "");
    const vectors = await generateEmbeddingsBatch(titles);

    let processedCount = 0;

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const vector = vectors[i];

        if (vector) {
            try {
                // Insert into rss_vectors table
                db.prepare(`
                    INSERT INTO rss_vectors (entry_id, title, content, feed_id, published_at, url)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(
                    entry.id,
                    entry.title || "No Title",
                    entry.title || "", // content now stores title only
                    entry.feed_id,
                    entry.published_at || "",
                    entry.url || ""
                );

                // Insert vector into vss table
                const vectorBlob = Buffer.from(new Float32Array(vector).buffer);
                db.prepare(`
                    INSERT INTO vss_rss_vectors (rowid, embedding)
                    VALUES ((SELECT rowid FROM rss_vectors WHERE entry_id = ?), ?)
                `).run(entry.id, vectorBlob);

                processedCount++;
            } catch (error) {
                console.error(`[Vector] Error inserting vector for entry ${entry.id}:`, error);
            }
        }
    }

    if (processedCount > 0) {
        console.log(`[Vector] Added ${processedCount} entries to vector DB.`);
    }

    return processedCount;
}
```

#### 4. 新增 rebuildVectorDB() - 重建向量库
```typescript
/**
 * Rebuild entire vector database (using title only + batch API)
 * Clears existing vectors and re-processes all entries
 * @param batchSize Number of entries to process per batch (default 100)
 * @returns Statistics about the rebuild process
 */
export async function rebuildVectorDB(batchSize: number = 100): Promise<{
    total: number;
    processed: number;
    failed: number;
}> {
    const db = getDatabase();

    console.log('[Vector] Starting vector database rebuild...');

    // Step 1: Clear existing vectors
    db.prepare('DELETE FROM vss_rss_vectors').run();
    db.prepare('DELETE FROM rss_vectors').run();
    console.log('[Vector] Cleared existing vector data');

    // Step 2: Get total count of entries with titles
    const totalResult = db.prepare(`
        SELECT COUNT(*) as count
        FROM entries
        WHERE title IS NOT NULL
        AND length(title) > 0
    `).get() as { count: number };

    const total = totalResult.count;
    let processed = 0;
    let failed = 0;
    let offset = 0;

    console.log(`[Vector] Found ${total} entries to process`);

    // Step 3: Process in batches
    while (offset < total) {
        const entries = db.prepare(`
            SELECT id, title, feed_id, published_at, url
            FROM entries
            WHERE title IS NOT NULL
            AND length(title) > 0
            ORDER BY inserted_at DESC
            LIMIT ? OFFSET ?
        `).all(batchSize, offset) as any[];

        if (entries.length === 0) break;

        // Batch generate embeddings for all titles
        const titles = entries.map(e => e.title || "");
        const vectors = await generateEmbeddingsBatch(titles);

        // Insert all vectors
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const vector = vectors[i];

            if (vector) {
                try {
                    db.prepare(`
                        INSERT INTO rss_vectors (entry_id, title, content, feed_id, published_at, url)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `).run(
                        entry.id,
                        entry.title || "No Title",
                        entry.title || "",
                        entry.feed_id,
                        entry.published_at || "",
                        entry.url || ""
                    );

                    const vectorBlob = Buffer.from(new Float32Array(vector).buffer);
                    db.prepare(`
                        INSERT INTO vss_rss_vectors (rowid, embedding)
                        VALUES ((SELECT rowid FROM rss_vectors WHERE entry_id = ?), ?)
                    `).run(entry.id, vectorBlob);

                    processed++;
                } catch (error) {
                    console.error(`[Vector] Error inserting vector for entry ${entry.id}:`, error);
                    failed++;
                }
            } else {
                failed++;
            }
        }

        offset += batchSize;
        const progress = Math.round((processed / total) * 100);
        console.log(`[Vector] Progress: ${processed}/${total} (${progress}%)`);
    }

    console.log(`[Vector] Rebuild complete: ${processed} processed, ${failed} failed`);
    return { total, processed, failed };
}
```

#### 5. 新增 getVectorStats() - 获取统计信息
```typescript
/**
 * Get vector database statistics
 */
export function getVectorStats(): {
    total_entries: number;
    vectorized_entries: number;
    pending_entries: number;
} {
    const db = getDatabase();

    const totalResult = db.prepare(`
        SELECT COUNT(*) as count
        FROM entries
        WHERE title IS NOT NULL
        AND length(title) > 0
    `).get() as { count: number };

    const vectorizedResult = db.prepare(`
        SELECT COUNT(*) as count FROM rss_vectors
    `).get() as { count: number };

    return {
        total_entries: totalResult.count,
        vectorized_entries: vectorizedResult.count,
        pending_entries: totalResult.count - vectorizedResult.count
    };
}
```

---

## 修改文件 2: backend-node/src/routes/ai.ts

### 在 aiRoutes() 函数末尾添加以下端点

#### 1. POST /ai/vector/rebuild - 重建向量库
```typescript
// POST /ai/vector/rebuild - Rebuild vector database
app.post('/ai/vector/rebuild', async (request, reply) => {
    try {
        const { rebuildVectorDB } = await import('../services/vector.js');

        // Check if embedding is configured
        const embeddingConfig = resolveServiceConfig('embedding' as any);
        if (!embeddingConfig.apiKey) {
            return reply.code(400).send({
                error: 'Embedding API key not configured'
            });
        }

        // Start rebuild (this will take time for large databases)
        const result = await rebuildVectorDB(100); // Batch size 100

        return {
            success: true,
            message: `Vector database rebuilt: ${result.processed} processed, ${result.failed} failed`,
            ...result
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Vector rebuild failed';
        console.error('[Vector] Rebuild error:', error);
        return reply.code(500).send({ error: message });
    }
});
```

#### 2. GET /ai/vector/stats - 获取统计信息
```typescript
// GET /ai/vector/stats - Get vector database statistics
app.get('/ai/vector/stats', async () => {
    try {
        const { getVectorStats } = await import('../services/vector.js');
        return getVectorStats();
    } catch (error) {
        console.error('[Vector] Stats error:', error);
        return {
            total_entries: 0,
            vectorized_entries: 0,
            pending_entries: 0
        };
    }
});
```

---

## 修改文件 3: rss-desktop/src/stores/aiStore.ts

### 在 useAIStore 中添加重建方法

在 return 语句之前添加：

```typescript
// 在 resetConfig() 函数后添加

async function rebuildVectors() {
    loading.value = true
    error.value = null
    try {
        const { data } = await api.post<{
            success: boolean
            message: string
            total: number
            processed: number
            failed: number
        }>('/ai/vector/rebuild')

        if (data.success) {
            return {
                success: true,
                message: data.message,
                stats: {
                    total: data.total,
                    processed: data.processed,
                    failed: data.failed
                }
            }
        } else {
            error.value = data.message || '重建向量库失败'
            return { success: false, message: error.value }
        }
    } catch (err) {
        console.error('Failed to rebuild vectors:', err)
        error.value = '重建向量库失败'
        return { success: false, message: error.value }
    } finally {
        loading.value = false
    }
}

async function getVectorStats() {
    try {
        const { data } = await api.get<{
            total_entries: number
            vectorized_entries: number
            pending_entries: number
        }>('/ai/vector/stats')
        return data
    } catch (err) {
        console.error('Failed to get vector stats:', err)
        return {
            total_entries: 0,
            vectorized_entries: 0,
            pending_entries: 0
        }
    }
}
```

然后在 return 对象中添加这两个方法：

```typescript
return {
    config,
    loading,
    error,
    fetchConfig,
    updateConfig,
    testConnection,
    clearError,
    resetConfig,
    rebuildVectors,      // 新增
    getVectorStats       // 新增
}
```

---

## 修改文件 4: rss-desktop/src/composables/useAIConfigSettings.ts

### 添加重建向量库的逻辑

在文件中添加：

```typescript
// 在 resetTestResults() 函数后添加

const rebuildingVectors = ref(false)
const rebuildResult = ref<TestResult | null>(null)

async function rebuildVectors() {
    if (!localConfig.value.embedding.api_key) {
        rebuildResult.value = {
            success: false,
            message: '请先配置 Embedding API'
        }
        return
    }

    // 确认对话框
    const confirmed = confirm(
        '确定要重建向量数据库吗？\n\n' +
        '这将清除现有向量并重新处理所有文章标题。\n' +
        '根据文章数量，可能需要几分钟时间。'
    )

    if (!confirmed) return

    rebuildingVectors.value = true
    rebuildResult.value = null

    try {
        const result = await aiStore.rebuildVectors()
        rebuildResult.value = {
            success: result.success,
            message: result.message || (result.success ? '重建成功！' : '重建失败')
        }

        // 3秒后清除结果
        setTimeout(() => {
            rebuildResult.value = null
        }, 5000)
    } catch (error) {
        rebuildResult.value = {
            success: false,
            message: '重建向量库失败'
        }
    } finally {
        rebuildingVectors.value = false
    }
}
```

然后在 return 对象中添加：

```typescript
return {
    serviceTesting,
    serviceTestResult,
    testConnection,
    copySummaryToTranslation,
    resetTestResults,
    rebuildingVectors,    // 新增
    rebuildResult,        // 新增
    rebuildVectors        // 新增
}
```

---

## 性能对比

### 原方案（全文 + 单个调用）
- 每个 entry: title(200) + summary(500) + content(1500) = 2200 字符
- API 调用次数: N 次（N = 文章数）
- 预计时间: 1000 篇文章 ≈ 10-20 分钟

### 新方案（title + 批量调用）
- 每个 entry: title(500) = 500 字符
- API 调用次数: N/100 次（批量 100）
- 预计时间: 1000 篇文章 ≈ 10-30 秒

**性能提升: 20-120 倍**

---

接下来我会继续输出前端部分的修改...
