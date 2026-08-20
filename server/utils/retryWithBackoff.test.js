import { describe, it, expect, vi } from 'vitest';
import { retryWithBackoff } from './retryWithBackoff.js';

function httpError(status) {
    return Object.assign(new Error('http error'), { response: { status } });
}

describe('retryWithBackoff', () => {
    it('returns the result on first success without retrying', async () => {
        const fn = vi.fn().mockResolvedValue('ok');
        const result = await retryWithBackoff(fn, { baseDelayMs: 1 });
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on 503 and eventually succeeds', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(httpError(503))
            .mockResolvedValueOnce('ok');
        const result = await retryWithBackoff(fn, { baseDelayMs: 1 });
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('retries on 429 up to the retry limit then throws', async () => {
        const fn = vi.fn().mockRejectedValue(httpError(429));
        await expect(retryWithBackoff(fn, { retries: 2, baseDelayMs: 1 })).rejects.toThrow('http error');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('does not retry non-retryable statuses like 400', async () => {
        const fn = vi.fn().mockRejectedValue(httpError(400));
        await expect(retryWithBackoff(fn, { baseDelayMs: 1 })).rejects.toThrow('http error');
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
