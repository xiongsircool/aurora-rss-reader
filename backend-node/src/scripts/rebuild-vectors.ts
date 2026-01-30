/**
 * Rebuild Vector Database Script
 * 
 * This script will:
 * 1. Drop existing vector tables
 * 2. Recreate them with the correct dimensions
 * 3. Regenerate embeddings for all entries
 * 
 * Usage: npx tsx src/scripts/rebuild-vectors.ts [--dimension=768]
 */

import { getDatabase } from '../db/session.js';
import { initDatabase } from '../db/init.js';
import { syncEntriesToVectorDB, generateEmbedding } from '../services/vector.js';

// Parse command line arguments
const args = process.argv.slice(2);
const dimensionArg = args.find(a => a.startsWith('--dimension='));
const VECTOR_DIMENSION = dimensionArg ? parseInt(dimensionArg.split('=')[1]) : 768;

async function main() {
    console.log('🔄 Vector Database Rebuild Script');
    console.log(`   Target dimension: ${VECTOR_DIMENSION}`);
    console.log('');

    // Initialize database connection
    initDatabase();
    const db = getDatabase();

    // Step 1: Check current state
    console.log('📊 Step 1: Checking current state...');

    const vectorCount = db.prepare('SELECT COUNT(*) as count FROM rss_vectors').get() as { count: number };
    console.log(`   Current vector count: ${vectorCount.count}`);

    const entryCount = db.prepare('SELECT COUNT(*) as count FROM entries WHERE content IS NOT NULL AND length(content) > 50').get() as { count: number };
    console.log(`   Entries eligible for vectorization: ${entryCount.count}`);

    // Step 2: Test embedding API
    console.log('');
    console.log('🧪 Step 2: Testing embedding API...');

    try {
        const testVector = await generateEmbedding('测试文本 test text');
        if (!testVector) {
            console.error('❌ Embedding API not configured or returned null');
            console.log('   Please configure embedding API in settings first.');
            process.exit(1);
        }
        console.log(`   ✅ Embedding API working! Vector dimension: ${testVector.length}`);

        if (testVector.length !== VECTOR_DIMENSION) {
            console.log(`   ⚠️  Detected dimension (${testVector.length}) differs from target (${VECTOR_DIMENSION})`);
            console.log(`   Will use detected dimension: ${testVector.length}`);
        }

        const actualDimension = testVector.length;

        // Step 3: Drop existing vector tables
        console.log('');
        console.log('🗑️  Step 3: Dropping existing vector tables...');

        try {
            db.exec('DROP TABLE IF EXISTS vss_rss_vectors');
            console.log('   Dropped vss_rss_vectors');
        } catch (e) {
            console.log('   vss_rss_vectors not found or already dropped');
        }

        try {
            db.exec('DROP TABLE IF EXISTS rss_vectors');
            console.log('   Dropped rss_vectors');
        } catch (e) {
            console.log('   rss_vectors not found or already dropped');
        }

        // Step 4: Recreate tables with correct dimension
        console.log('');
        console.log(`📦 Step 4: Creating vector tables with dimension ${actualDimension}...`);

        // Create rss_vectors table (metadata)
        db.exec(`
            CREATE TABLE IF NOT EXISTS rss_vectors (
                rowid INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_id TEXT UNIQUE NOT NULL,
                title TEXT,
                content TEXT,
                feed_id TEXT,
                published_at TEXT,
                url TEXT
            )
        `);
        console.log('   Created rss_vectors table');

        // Create VSS virtual table
        db.exec(`
            CREATE VIRTUAL TABLE IF NOT EXISTS vss_rss_vectors USING vss0 (
                embedding(${actualDimension})
            )
        `);
        console.log(`   Created vss_rss_vectors with dimension ${actualDimension}`);

        // Step 5: Sync entries
        console.log('');
        console.log('🔄 Step 5: Generating embeddings for entries...');
        console.log('   This may take a while depending on the number of entries...');
        console.log('');

        const batchSize = 10;
        let totalProcessed = 0;
        let hasMore = true;

        while (hasMore) {
            const processed = await syncEntriesToVectorDB(batchSize);
            totalProcessed += processed;

            if (processed > 0) {
                process.stdout.write(`   Processed: ${totalProcessed} entries\r`);
            }

            hasMore = processed === batchSize;

            // Small delay to avoid rate limiting
            if (hasMore) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        console.log('');
        console.log('');
        console.log('✅ Vector database rebuild complete!');
        console.log(`   Total entries vectorized: ${totalProcessed}`);

        // Final verification
        const finalCount = db.prepare('SELECT COUNT(*) as count FROM rss_vectors').get() as { count: number };
        console.log(`   Vectors in database: ${finalCount.count}`);

    } catch (error) {
        console.error('❌ Error during rebuild:', error);
        process.exit(1);
    }
}

main().catch(console.error);
