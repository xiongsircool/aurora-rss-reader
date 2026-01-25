
import * as lancedb from "@lancedb/lancedb";
import OpenAI from "openai";
import path from "path";
import fs from "fs";

// Configuration from user
const CONFIG = {
    apiKey: "sk-nihhjskdaommndqhohdrneftvrfukgavarvteuearcrdjgqw",
    baseURL: "https://api.siliconflow.cn/v1",
    modelName: "netease-youdao/bce-embedding-base_v1"
};

// Initialize OpenAI client for SiliconFlow
const client = new OpenAI({
    apiKey: CONFIG.apiKey,
    baseURL: CONFIG.baseURL
});

// Sample Data: Simulating RSS Articles
const DATA = [
    {
        id: "1",
        title: "DeepSeek 发布新一代开源模型",
        content: "DeepSeek-V3 发布，性能对标 GPT-4，在多个榜单上取得领先成绩。国产大模型再次取得突破。",
        category: "AI"
    },
    {
        id: "2",
        title: "SpaceX 星舰第四次试飞成功",
        content: "SpaceX Starship 成功完成第四次轨道试飞，助推器和飞船均成功软着陆。马斯克表示下一步是回收。",
        category: "Space"
    },
    {
        id: "3",
        title: "Python 3.13 新特性预览",
        content: "Python 3.13 移除了 GIL (全局解释器锁)，这将大幅提升多线程性能。社区对此表示热烈欢迎。",
        category: "Programming"
    },
    {
        id: "4",
        title: "如何制作美味的红烧肉",
        content: "五花肉切块，糖色炒好，加入生抽老抽，小火慢炖一小时。关键是火候和选材。",
        category: "Cooking"
    }
];

async function getEmbedding(text: string) {
    try {
        const response = await client.embeddings.create({
            model: CONFIG.modelName,
            input: text,
            encoding_format: "float"
        });
        return response.data[0].embedding;
    } catch (error) {
        console.error("Error fetching embedding:", error);
        throw error;
    }
}

async function main() {
    console.log("🚀 Starting LanceDB Vector Test (Real API Mode)...");

    // 1. Prepare Data with Embeddings
    console.log("📊 Generating embeddings for sample data...");
    const dataWithEmbeddings = [];

    for (const item of DATA) {
        // Combine title and content for embedding
        const textToEmbed = `${item.title} ${item.content}`;
        console.log(`   - Embedding: ${item.title}`);
        const vector = await getEmbedding(textToEmbed);

        dataWithEmbeddings.push({
            ...item,
            vector: vector
        });
    }

    console.log(`✅ Generated ${dataWithEmbeddings.length} embeddings.`);

    // 2. Initialize LanceDB
    const dbDir = path.join(process.cwd(), "data", "test-lancedb");
    // Ensure data directory exists
    if (!fs.existsSync(path.join(process.cwd(), "data"))) {
        fs.mkdirSync(path.join(process.cwd(), "data"));
    }

    console.log(`💾 Connecting to LanceDB at: ${dbDir}`);
    const db = await lancedb.connect(dbDir);

    // 3. Create Table
    const tableName = "rss_test_vectors";

    // Drop if exists to start fresh
    try {
        // In @lancedb/lancedb v0.4+, access tables differently or just overwrite
        // We will try to overwrite
        await db.createTable(tableName, dataWithEmbeddings, { mode: "overwrite" });
        console.log(`📝 Table '${tableName}' created successfully.`);
    } catch (e) {
        console.log("Table creation note:", e);
        // If overwrite matches, it should work.
    }

    const table = await db.openTable(tableName);

    // 4. Perform Vector Search
    const queryText = "国产 AI 模型进展";
    console.log(`\n🔍 Performing search for query: "${queryText}"`);

    const queryVector = await getEmbedding(queryText);

    const results = await table.vectorSearch(queryVector)
        .limit(2)
        .toArray();

    console.log("\n🎯 Search Results:");
    results.forEach((r, index) => {
        console.log(`\n[Rank ${index + 1}] (Distance: ${r._distance})`);
        console.log(`Title: ${r.title}`);
        console.log(`Content: ${r.content}`);
        console.log(`Category: ${r.category}`);
    });

    // Another test
    const queryText2 = "编程语言性能优化";
    console.log(`\n\n🔍 Performing search for query: "${queryText2}"`);
    const queryVector2 = await getEmbedding(queryText2);
    const results2 = await table.vectorSearch(queryVector2)
        .limit(1)
        .toArray();

    console.log("\n🎯 Search Results:");
    results2.forEach((r, index) => {
        console.log(`\n[Rank ${index + 1}] (Distance: ${r._distance})`);
        console.log(`Title: ${r.title}`);
    });

    console.log("\n✨ Test completed successfully!");
}

main().catch(console.error);
