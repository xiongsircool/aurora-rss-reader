import OpenAI from "openai";
import { userSettingsService } from "./userSettings.js";
import { getDatabase } from "../db/session.js";

// Interfaces
interface RssVectorItem {
    id: string;      // Entry ID
    title: string;
    content: string; // The text content used for embedding
    feed_id: string;
    published_at: string;
    url: string;
}

interface VectorSearchResult extends RssVectorItem {
    distance: number;
}

let openaiClient: OpenAI | null = null;

/**
 * Get OpenAI Client based on user settings
 */
async function getOpenAIClient(): Promise<OpenAI | null> {
    const settings = userSettingsService.getSettings();

    if (!settings.embedding_api_key) {
        console.warn("[Vector] No embedding API key configured");
        return null;
    }

    // Check if client needs to be re-initialized (key/url changed)
    if (openaiClient) {
        if (openaiClient.apiKey !== settings.embedding_api_key ||
            openaiClient.baseURL !== settings.embedding_base_url) {
            console.log("[Vector] Re-initializing OpenAI client with new settings");
            openaiClient = null;
        }
    }

    if (!openaiClient) {
        openaiClient = new OpenAI({
            apiKey: settings.embedding_api_key,
            baseURL: settings.embedding_base_url,
        });
    }

    return openaiClient;
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
    try {
        const client = await getOpenAIClient();
        if (!client) return null;

        const settings = userSettingsService.getSettings();
        if (!text || text.trim().length === 0) return null;

        // Truncate text if too long (simple protection)
        const truncatedText = text.substring(0, 8000);

        const response = await client.embeddings.create({
            model: settings.embedding_model,
            input: truncatedText,
            encoding_format: "float",
        });

        return response.data[0].embedding;
    } catch (error) {
        console.error("[Vector] Error generating embedding:", error);
        return null;
    }
}

/**
 * Generate embeddings for multiple texts in batch (OpenAI compatible API)
 * @param texts Array of texts to embed
 * @returns Array of embeddings (same order as input, null for failed items)
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<(number[] | null)[]> {
    try {
        const client = await getOpenAIClient();
        if (!client) return texts.map(() => null);

        const settings = userSettingsService.getSettings();
        if (texts.length === 0) return [];

        // Filter and truncate texts (limit title length to 500 chars)
        const processedTexts = texts.map(text => {
            if (!text || text.trim().length === 0) return "";
            return text.substring(0, 500);
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

/**
 * Sync un-vectorized entries to Vector DB (using title only + batch API)
 * @param limit Max number of entries to process in this batch
 */
export async function syncEntriesToVectorDB(limit: number = 50): Promise<number> {
    const db = getDatabase();

    // Get entries that don't have vectors yet (only need title)
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
                // Insert into rss_vectors table (content now stores title only)
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

/**
 * Semantic Search using sqlite-vss
 */
export async function searchVectors(query: string, limit: number = 10): Promise<VectorSearchResult[]> {
    const db = getDatabase();
    const vector = await generateEmbedding(query);

    if (!vector) {
        throw new Error("Failed to generate embedding for query");
    }

    // Convert vector to blob for sqlite-vss
    const vectorBlob = Buffer.from(new Float32Array(vector).buffer);

    // Search using vss_search with limit inside the function
    // Note: vss_search requires the limit to be passed as second parameter
    const results = db.prepare(`
        SELECT
            v.entry_id as id,
            v.title,
            v.content,
            v.feed_id,
            v.published_at,
            v.url,
            vss.distance
        FROM vss_rss_vectors vss
        JOIN rss_vectors v ON v.rowid = vss.rowid
        WHERE vss_search(vss.embedding, vss_search_params(?, ?))
        ORDER BY vss.distance
    `).all(vectorBlob, limit) as VectorSearchResult[];

    return results;
}

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

/**
 * Rebuild entire vector database (using title only + batch API)
 * Clears existing vectors and re-processes all entries
 * @param batchSize Number of entries to process per batch (default 50, max 100)
 * @returns Statistics about the rebuild process
 */
export async function rebuildVectorDB(batchSize: number = 50): Promise<{
    total: number;
    processed: number;
    failed: number;
}> {
    const db = getDatabase();

    // Limit batch size to avoid overwhelming the API
    const safeBatchSize = Math.min(Math.max(batchSize, 10), 100);

    console.log('[Vector] Starting vector database rebuild...');

    // Step 1: Clear existing vectors
    db.prepare('DELETE FROM vss_rss_vectors').run();
    db.prepare('DELETE FROM rss_vectors').run();
    console.log('[Vector] Cleared existing vector data');

    // Step 2: Get total count
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
        `).all(safeBatchSize, offset) as any[];

        if (entries.length === 0) break;

        // Batch generate embeddings
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

        offset += safeBatchSize;
        const progress = Math.round((processed / total) * 100);
        console.log(`[Vector] Progress: ${processed}/${total} (${progress}%)`);
    }

    console.log(`[Vector] Rebuild complete: ${processed} processed, ${failed} failed`);
    return { total, processed, failed };
}
