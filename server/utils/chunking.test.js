import { describe, it, expect } from 'vitest';
import { chunkText } from './chunking.js';

describe('chunkText', () => {
    it('returns an empty array for empty/whitespace input', () => {
        expect(chunkText('')).toEqual([]);
        expect(chunkText('   ')).toEqual([]);
        expect(chunkText(undefined)).toEqual([]);
    });

    it('returns a single chunk for short text', () => {
        const text = 'Employees get 20 vacation days per year.';
        expect(chunkText(text)).toEqual([text]);
    });

    it('splits long text into multiple overlapping chunks', () => {
        const sentence = 'This is a policy sentence about vacation days. ';
        const longText = sentence.repeat(100); // ~4800 chars
        const chunks = chunkText(longText);

        expect(chunks.length).toBeGreaterThan(1);
        for (const chunk of chunks) {
            expect(chunk.length).toBeLessThanOrEqual(1500);
            expect(chunk.length).toBeGreaterThan(0);
        }
    });

    it('does not lose content across chunk boundaries', () => {
        const longText = Array.from({ length: 50 }, (_, i) => `Sentence number ${i}.`).join(' ');
        const chunks = chunkText(longText);
        const rejoined = chunks.join(' ');
        // Every sentence marker should appear somewhere in the chunked output.
        for (let i = 0; i < 50; i++) {
            expect(rejoined).toContain(`Sentence number ${i}.`);
        }
    });
});
