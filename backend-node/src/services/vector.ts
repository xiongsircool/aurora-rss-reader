import * as lancedb from "@lancedb/lancedb";
import OpenAI from "openai";
import path from "path";
import fs from "fs";
import { userSettingsService } from "./userSettings.js";
import { getDatabase } from "../db/session.js";

// Constants
const DB_DIR_NAME = "lancedb";
const VECTOR_TABLE_NAME = "rss_vectors";

// Interfaces
interface RssVectorItem {
    id: string;      // Entry ID
    vector: number[]; // Embedding vector
    title: string;
    content: string; // The text content used for embedding
    feed_id: string;
    published_at: string;
    url: string;
}

let dbInstance: lancedb.Connection | null = null;
let openaiClient: OpenAI | null = null;

/**
 * Initialize LanceDB connection
 */
export async function initVectorDB(): Promise<lancedb.Connection> {
    if (dbInstance) return dbInstance;

    const dbPath = path.join(process.cwd(), "data", DB_DIR_NAME);

    if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(dbPath, { recursive: true });
    }

    console.log(`[Vector] Connecting to LanceDB at ${dbPath}`);
    dbInstance = await lancedb.connect(dbPath);
    return dbInstance;
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
 * Sync un-vectorized entries to LanceDB
 * @param limit Max number of entries to process in this batch
 */
export async function syncEntriesToVectorDB(limit: number = 10): Promise<number> {
    const db = await initVectorDB();
    const sqlite = getDatabase();

    // 1. Ensure table exists
    let table: lancedb.Table;
    try {
        table = await db.openTable(VECTOR_TABLE_NAME);
    } catch {
        // Determine dimension based on model? For now assume standard or user config
        // Actually LanceDB infers schema from first data. 
        // We will handle first insertion logic below.
        console.log(`[Vector] Table ${VECTOR_TABLE_NAME} does not exist, will create on first insert.`);
    }

    // 2. Find entries that are NOT in vector DB
    // Since we can't easily JOIN across SQLite and LanceDB, we use a simple strategy:
    // Get latest Entry IDs from SQLite and check if they exist in LanceDB?
    // Or better: Add a 'vectorized' column to SQLite entries table? 
    // For now, let's keep it non-intrusive: 
    // We will select a batch of recent articles from SQLite.
    // Then we check which ones are already in LanceDB (by ID).

    // Strategy:
    // We can query LanceDB for "all IDs" if dataset is small.
    // Or query SQLite for entries, then filter.
    // Given we are running locally, let's try:
    // Select entries from SQLite where published_at > some_date order by inserted_at desc limit X
    // Check if ID exists in LanceDB.

    // Refined Strategy:
    // Just get the latest entries. We will rely on LanceDB's merge/upsert capabilities or simple check.
    // Let's grab 50 recent entries from SQLite.

    const entries = sqlite.prepare(`
    SELECT id, title, content, summary, feed_id, published_at, url 
    FROM entries 
    WHERE content IS NOT NULL AND length(content) > 50
    ORDER BY inserted_at DESC 
    LIMIT 200
  `).all() as any[];

    if (entries.length === 0) return 0;

    // Get existing IDs from LanceDB to avoid re-processing
    let existingIds: Set<string> = new Set();
    try {
        const t = await db.openTable(VECTOR_TABLE_NAME);
        // This might be slow if table is huge, but for local RSS it's fine for now.
        // Optimization: Only query IDs in the candidate list.
        // LanceDB filtering: "id IN ['a','b']"
        const idList = entries.map(e => `'${e.id}'`).join(",");
        const existing = await t.query()
            .where(`id IN (${idList})`)
            .select(["id"])
            .limit(entries.length)
            .toArray();
        existing.forEach((r: any) => existingIds.add(r.id));
    } catch (e) {
        // Table doesn't exist yet, so no existing IDs
    }

    const newEntries = entries.filter(e => !existingIds.has(e.id));

    if (newEntries.length === 0) {
        // console.log("[Vector] No new entries to sync in this batch check.");
        return 0;
    }

    // Limit processing to requested limit
    const entriesToProcess = newEntries.slice(0, limit);
    console.log(`[Vector] Processing ${entriesToProcess.length} new entries...`);

    const vectorItems: RssVectorItem[] = [];

    for (const entry of entriesToProcess) {
        // Prepare text for embedding: Title + Summary + Content (truncated)
        // Clean HTML from content? Ideally yes. For now assume content is relatively clean or raw text.
        // Note: entry.readability_content is usually HTML. We should strip tags if we can, or just embed raw.
        // Simpler: Title + Summary is often enough for high quality retrieval.
        // Let's use Title + Summary + First 500 chars of content.

        // Simple HTML strip regex
        const cleanContent = (entry.content || "").replace(/<[^>]*>?/gm, "").substring(0, 5000);
        const summary = entry.summary || "";
        const textToEmbed = `${entry.title || ""} \n ${summary} \n ${cleanContent}`;

        const vector = await generateEmbedding(textToEmbed);

        if (vector) {
            vectorItems.push({
                id: entry.id,
                vector: vector,
                title: entry.title || "No Title",
                content: textToEmbed, // Storing what we embedded for debugging/context
                feed_id: entry.feed_id,
                published_at: entry.published_at || "",
                url: entry.url || ""
            });
        }
    }

    if (vectorItems.length > 0) {
        try {
            const t = await db.openTable(VECTOR_TABLE_NAME);
            await t.add(vectorItems as any[]);
            console.log(`[Vector] Added ${vectorItems.length} entries to LanceDB.`);
        } catch (e) {
            // Create table if not exists with data
            await db.createTable(VECTOR_TABLE_NAME, vectorItems as any[]);
            console.log(`[Vector] Created table and added ${vectorItems.length} entries.`);
        }
    }
    return vectorItems.length;
}


/**
 * Semantic Search
 */
export async function searchVectors(query: string, limit: number = 10) {
    const db = await initVectorDB();
    const vector = await generateEmbedding(query);

    if (!vector) {
        throw new Error("Failed to generate embedding for query");
    }

    const table = await db.openTable(VECTOR_TABLE_NAME);
    const results = await table.vectorSearch(vector)
        .limit(limit)
        .toArray();

    return results;
}
