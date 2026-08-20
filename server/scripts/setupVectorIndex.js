import 'dotenv/config';
import mongoose from 'mongoose';
import Chunk from '../models/Chunk.js';
import { VECTOR_INDEX_NAME } from '../utils/retrieval.js';
import { logger } from '../utils/logger.js';

// One-time (and idempotent) setup: creates the Atlas Vector Search index that
// utils/retrieval.js queries via $vectorSearch. Run with `npm run setup:vector-index`
// after MONGODB_URI is configured and at least one document has been uploaded
// (the `chunks` collection must exist before Atlas will let you define a
// search index on it). Chat works without this — see retrieveContext's
// fallback — but retrieval quality/cost only improves once it exists.
const EMBEDDING_DIMENSIONS = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS) || 768;

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not set');

    await mongoose.connect(uri);
    const collection = Chunk.collection;

    const existing = await collection.listSearchIndexes(VECTOR_INDEX_NAME).toArray().catch(() => []);
    if (existing.length > 0) {
        logger.info({ index: VECTOR_INDEX_NAME }, 'Vector search index already exists, skipping');
        await mongoose.disconnect();
        return;
    }

    await collection.createSearchIndex({
        name: VECTOR_INDEX_NAME,
        type: 'vectorSearch',
        definition: {
            fields: [
                { type: 'vector', path: 'embedding', numDimensions: EMBEDDING_DIMENSIONS, similarity: 'cosine' },
                { type: 'filter', path: 'organizationId' },
            ],
        },
    });

    logger.info({ index: VECTOR_INDEX_NAME }, 'Vector search index creation requested — Atlas builds it asynchronously; it may take a few minutes to become queryable');
    await mongoose.disconnect();
}

main().catch((err) => {
    logger.error({ err }, 'Failed to set up vector search index');
    process.exit(1);
});
