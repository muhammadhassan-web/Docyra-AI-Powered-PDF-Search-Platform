import axios from 'axios';
import { retryWithBackoff } from './retryWithBackoff.js';

// Gemini's embedding API (free tier, no credit card) — plain REST, same
// pattern as utils/gemini.js.
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
// gemini-embedding-001 outputs 3072 dims by default but supports Matryoshka
// truncation via outputDimensionality — keep this in sync with
// GEMINI_EMBEDDING_DIMENSIONS / scripts/setupVectorIndex.js's index definition.
const OUTPUT_DIMENSIONALITY = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS) || 768;
const BATCH_SIZE = 90; // Gemini's batchEmbedContents cap is ~100 requests per call; leave headroom.

function requireApiKey() {
    if (!process.env.GEMINI_API_KEY) {
        throw Object.assign(new Error('Embeddings are not configured (GEMINI_API_KEY missing)'), { status: 500 });
    }
}

// taskType: RETRIEVAL_DOCUMENT for text being stored, RETRIEVAL_QUERY for the
// question being searched — Gemini optimizes each differently.
export async function embedDocuments(texts) {
    requireApiKey();
    const results = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);
        const response = await retryWithBackoff(() => axios.post(
            `${GEMINI_URL}/models/${MODEL}:batchEmbedContents?key=${process.env.GEMINI_API_KEY}`,
            {
                requests: batch.map(text => ({
                    model: `models/${MODEL}`,
                    content: { parts: [{ text }] },
                    taskType: 'RETRIEVAL_DOCUMENT',
                    outputDimensionality: OUTPUT_DIMENSIONALITY,
                })),
            },
            { timeout: 20000 }
        ));
        results.push(...response.data.embeddings.map(e => e.values));
    }
    return results;
}

export async function embedQuery(text) {
    requireApiKey();
    const response = await retryWithBackoff(() => axios.post(
        `${GEMINI_URL}/models/${MODEL}:embedContent?key=${process.env.GEMINI_API_KEY}`,
        { content: { parts: [{ text }] }, taskType: 'RETRIEVAL_QUERY', outputDimensionality: OUTPUT_DIMENSIONALITY },
        { timeout: 20000 }
    ));
    return response.data.embedding.values;
}
