import Chunk from '../models/Chunk.js';
import Policy from '../models/Policy.js';
import { embedQuery } from './embeddings.js';
import { logger } from './logger.js';

export const VECTOR_INDEX_NAME = 'policy_chunks_vector_index';
const TOP_K = 8;
const MAX_CONTEXT_CHARS = 12000; // ~3-4k tokens, leaving room for system prompt + history + response
const FALLBACK_MAX_DOC_CHARS = 6000;
const FALLBACK_MAX_DOCS = 20;

function capContext(chunks) {
    let used = 0;
    const kept = [];
    for (const c of chunks) {
        if (used + c.text.length > MAX_CONTEXT_CHARS && kept.length > 0) break;
        kept.push(c);
        used += c.text.length;
    }
    return kept;
}

async function vectorSearchChunks(organizationId, query) {
    const embedding = await embedQuery(query);
    const results = await Chunk.aggregate([
        {
            $vectorSearch: {
                index: VECTOR_INDEX_NAME,
                path: 'embedding',
                queryVector: embedding,
                numCandidates: TOP_K * 20,
                limit: TOP_K,
                filter: { organizationId },
            },
        },
        { $project: { text: 1, policyName: 1, department: 1 } },
    ]);
    return results;
}

// Chunking + Atlas Vector Search retrieval, degrading gracefully to a bounded
// full-document dump when: embeddings aren't configured yet (no GEMINI_API_KEY),
// this org's documents haven't been embedded, or the Atlas Vector Search index
// hasn't been created yet (see scripts/setupVectorIndex.js) — chat keeps working
// in all of those cases, just without real semantic retrieval.
export async function retrieveContext(organizationId, query) {
    const hasChunks = await Chunk.exists({ organizationId });

    if (hasChunks) {
        try {
            const chunks = await vectorSearchChunks(organizationId, query);
            if (chunks.length > 0) {
                return {
                    mode: 'vector',
                    documents: capContext(chunks).map(c => ({ name: c.policyName, department: c.department, content: c.text })),
                };
            }
        } catch (err) {
            logger.error({ err, organizationId }, 'Vector search failed, falling back to unretrieved context');
        }
    }

    const policies = await Policy.find({ organizationId })
        .select('name department content')
        .sort({ updatedAt: -1 })
        .limit(FALLBACK_MAX_DOCS);

    return {
        mode: 'fallback',
        documents: policies.map(p => ({ name: p.name, department: p.department, content: (p.content || '').slice(0, FALLBACK_MAX_DOC_CHARS) })),
    };
}
