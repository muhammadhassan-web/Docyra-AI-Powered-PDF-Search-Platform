import axios from 'axios';
import { logger } from './logger.js';
import { retryWithBackoff } from './retryWithBackoff.js';

// Plain REST call to Google's Gemini API — no SDK dependency, same pattern as
// utils/embeddings.js. Gemini's free tier (no credit card required) is what
// this app runs on; see .env.example for where to get a key.
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta';
// The "lite" variant, not "gemini-flash-latest" — the full flash model does
// extended internal reasoning by default even on trivial prompts, which both
// slows every answer by 10-20s+ and burns through free-tier quota far faster
// than a grounded-QA task like this needs.
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const MAX_DOC_CHARS = 6000;

const SYSTEM_PROMPT = `You are DOCYRA, an internal policy assistant for a company. You answer employee questions using ONLY the company policy documents provided below. Never use outside knowledge.

Rules:
- If the answer is covered by the documents, answer clearly and concisely.
- If the answer is not covered by the documents, say plainly that the vault doesn't cover it. Do not guess or invent an answer.
- Always end your response with a final line in the exact format: SOURCE: <document name>
- The document name in SOURCE must be copied exactly as it appears after "### Document:" below, WITHOUT the trailing department in parentheses.
- If you could not find a relevant answer, use: SOURCE: none`;

export function buildContext(policies) {
    return policies
        .map(p => `### Document: ${p.name} (${p.department})\n${(p.content || '').slice(0, MAX_DOC_CHARS)}`)
        .join('\n\n');
}

export function parseAnswer(text) {
    const match = text.match(/SOURCE:\s*(.+?)\s*$/i);
    const source = match ? match[1].trim() : 'none';
    const answer = match ? text.slice(0, match.index).trim() : text.trim();
    return { answer, source, grounded: source.toLowerCase() !== 'none' };
}

// The model self-reports its SOURCE line — nothing stops it from citing a
// document name that was never actually retrieved (hallucinated citation).
// Cross-check against the documents genuinely passed into this request
// before presenting the answer as "grounded" to the user.
//
// The prompt tells the model to omit the "(department)" suffix shown in the
// context, but instruction-following isn't a guarantee — strip a trailing
// "(...)" here too as defense in depth so a technically-correct citation
// isn't wrongly downgraded just because the model added it back.
function normalizeSourceName(name) {
    return name.toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function verifyCitation(result, documents) {
    if (!result.grounded) return result;
    const knownNames = new Set(documents.map(d => normalizeSourceName(d.name)));
    if (knownNames.has(normalizeSourceName(result.source))) {
        return { ...result, citationVerified: true };
    }
    return { ...result, grounded: false, citationVerified: false };
}

export async function answerFromPolicies(question, policies) {
    if (!process.env.GEMINI_API_KEY) {
        throw Object.assign(new Error('Chat is not configured (GEMINI_API_KEY missing)'), { status: 500 });
    }

    const context = buildContext(policies);

    let response;
    try {
        response = await retryWithBackoff(() => axios.post(
            `${GEMINI_URL}/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                contents: [
                    { role: 'user', parts: [{ text: `Company policy documents:\n\n${context}\n\nEmployee question: ${question}` }] },
                ],
                generationConfig: { maxOutputTokens: 500 },
            },
            { timeout: 30000 }
        ));
    } catch (err) {
        // The client only ever sees a generic message (no upstream details
        // leaked), but the real cause — rate limit, invalid model, quota,
        // network — needs to be in the logs or this is undiagnosable in prod.
        logger.error({ status: err.response?.status, data: err.response?.data, message: err.message }, 'Gemini generateContent call failed');
        throw Object.assign(new Error('The AI service is temporarily unavailable'), { status: err.response?.status || 502 });
    }

    const candidate = response.data.candidates?.[0];
    const text = candidate?.content?.parts?.map(p => p.text).join('') || '';
    const result = parseAnswer(text);
    // If the model was cut off by the output token cap, the SOURCE line (and
    // possibly the answer itself) may be missing or truncated — flag it so
    // the caller doesn't present a chopped-off answer as complete.
    if (candidate?.finishReason === 'MAX_TOKENS') result.truncated = true;
    return result;
}
