import { describe, it, expect } from 'vitest';
import { slugify } from './slug.js';

describe('slugify', () => {
    it('lowercases and hyphenates', () => {
        expect(slugify('Acme Corp')).toBe('acme-corp');
    });

    it('strips leading/trailing separators', () => {
        expect(slugify('  --Acme!!--  ')).toBe('acme');
    });

    it('collapses repeated non-alphanumeric runs', () => {
        expect(slugify('Acme &&& Co.')).toBe('acme-co');
    });

    it('handles purely non-alphanumeric input', () => {
        expect(slugify('!!!')).toBe('');
    });
});
