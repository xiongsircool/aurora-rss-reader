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
 * Initialize Vector DB (sqlite-vss)
 * This is now handled in db/init.ts as part of the main database
 */
export async function initVectorDB(): Promise<void> {
    // Vector tables are created in db/init.ts
    console.log('[Vector] Using sqlite-vss for vector storage');
}

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
 * Sync un-vectorized entries to Vector DB
 * @param limit Max number of entries to process in this batch
 */
export async function syncEntriesToVectorDB(limit: number = 10): Promise<number> {
    const db = getDatabase();

    // Get entries that don't have vectors yet
    const entries = db.prepare(`
        SELECT e.id, e.title, e.content, e.summary, e.feed_id, e.published_at, e.url
        FROM entries e
        LEFT JOIN rss_vectors v ON e.id = v.entry_id
        WHERE v.entry_id IS NULL
        AND e.content IS NOT NULL
        AND length(e.content) > 50
        ORDER BY e.inserted_at DESC
        LIMIT ?
    `).all(limit) as any[];

    if (entries.length === 0) {
        return 0;
    }

    console.log(`[Vector] Processing ${entries.length} new entries...`);

    let processedCount = 0;

    for (const entry of entries) {
        // Prepare text for embedding
        const cleanContent = (entry.content || "").replace(/<[^>]*>?/gm, "").substring(0, 5000);
        const summary = entry.summary || "";
        const textToEmbed = `${entry.title || ""} \n ${summary} \n ${cleanContent}`;

        const vector = await generateEmbedding(textToEmbed);

        if (vector) {
            try {
                // Insert into rss_vectors table
                db.prepare(`
                    INSERT INTO rss_vectors (entry_id, title, content, feed_id, published_at, url)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(entry.id, entry.title || "No Title", textToEmbed, entry.feed_id, entry.published_at || "", entry.url || "");

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

    // Search using vss_search
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
        WHERE vss_search(vss.embedding, ?)
        ORDER BY vss.distance
        LIMIT ?
    `).all(vectorBlob, limit) as VectorSearchResult[];

    return results;
}

