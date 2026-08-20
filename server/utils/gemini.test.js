import { describe, it, expect } from 'vitest';
import { parseAnswer, buildContext, verifyCitation } from './gemini.js';

describe('parseAnswer', () => {
    it('extracts the answer and source when SOURCE line is present', () => {
        const result = parseAnswer('Vacation is 20 days per year.\nSOURCE: HR Handbook');
        expect(result.answer).toBe('Vacation is 20 days per year.');
        expect(result.source).toBe('HR Handbook');
        expect(result.grounded).toBe(true);
    });

    it('treats SOURCE: none as ungrounded', () => {
        const result = parseAnswer("I don't know.\nSOURCE: none");
        expect(result.grounded).toBe(false);
        expect(result.source).toBe('none');
    });

    it('falls back gracefully when there is no SOURCE line', () => {
        const result = parseAnswer('Just an answer with no source marker.');
        expect(result.answer).toBe('Just an answer with no source marker.');
        expect(result.source).toBe('none');
        expect(result.grounded).toBe(false);
    });
});

describe('buildContext', () => {
    it('formats each policy with its name and department', () => {
        const context = buildContext([{ name: 'PTO Policy', department: 'HR', content: 'Employees get 20 days.' }]);
        expect(context).toContain('### Document: PTO Policy (HR)');
        expect(context).toContain('Employees get 20 days.');
    });

    it('truncates very long content', () => {
        const longContent = 'a'.repeat(10000);
        const context = buildContext([{ name: 'Big Doc', department: 'IT', content: longContent }]);
        expect(context.length).toBeLessThan(longContent.length);
    });

    it('handles missing content without throwing', () => {
        expect(() => buildContext([{ name: 'Empty', department: 'HR' }])).not.toThrow();
    });
});

describe('verifyCitation', () => {
    const documents = [{ name: 'PTO Policy', department: 'HR', content: '...' }];

    it('keeps grounded=true when the cited source matches a retrieved document', () => {
        const result = verifyCitation({ answer: 'x', source: 'PTO Policy', grounded: true }, documents);
        expect(result.grounded).toBe(true);
        expect(result.citationVerified).toBe(true);
    });

    it('matches case-insensitively', () => {
        const result = verifyCitation({ answer: 'x', source: 'pto policy', grounded: true }, documents);
        expect(result.grounded).toBe(true);
        expect(result.citationVerified).toBe(true);
    });

    it('downgrades grounded=false when the model hallucinates a citation not in the retrieved set', () => {
        const result = verifyCitation({ answer: 'x', source: 'Made Up Document', grounded: true }, documents);
        expect(result.grounded).toBe(false);
        expect(result.citationVerified).toBe(false);
    });

    it('leaves an already-ungrounded result untouched', () => {
        const result = verifyCitation({ answer: 'x', source: 'none', grounded: false }, documents);
        expect(result.grounded).toBe(false);
        expect(result.citationVerified).toBeUndefined();
    });

    it('still matches when the model echoes the "(department)" suffix shown in buildContext', () => {
        // Regression test: buildContext formats documents as "name (department)",
        // and despite the prompt telling the model to omit that suffix in
        // SOURCE, it doesn't always comply — a correct citation shouldn't be
        // downgraded to ungrounded just because of the extra "(HR)".
        const result = verifyCitation({ answer: 'x', source: 'PTO Policy (HR)', grounded: true }, documents);
        expect(result.grounded).toBe(true);
        expect(result.citationVerified).toBe(true);
    });
});
