const RETRYABLE_STATUSES = new Set([429, 503]);

// Gemini's free tier returns 429 (rate limited) and 503 ("high demand",
// observed in practice — not hypothetical) for transient conditions that
// usually clear within seconds. Retrying once or twice with backoff turns
// those into a slightly slower successful response instead of a failed
// chat message / silently un-embedded document.
export async function retryWithBackoff(fn, { retries = 2, baseDelayMs = 1000 } = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            const status = err.response?.status;
            if (!RETRYABLE_STATUSES.has(status) || attempt === retries) throw err;
            await new Promise(resolve => setTimeout(resolve, baseDelayMs * 2 ** attempt));
        }
    }
    throw lastErr;
}
