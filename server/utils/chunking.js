const CHUNK_CHARS = 1500;
const CHUNK_OVERLAP = 200;

// Splits on paragraph/sentence boundaries where possible so a chunk doesn't
// cut a sentence in half, falling back to a hard slice for runs of text with
// no punctuation (e.g. a wall of numbers/table data extracted from a PDF).
export function chunkText(text) {
    const clean = (text || '').trim();
    if (!clean) return [];
    if (clean.length <= CHUNK_CHARS) return [clean];

    const chunks = [];
    let start = 0;

    while (start < clean.length) {
        let end = Math.min(start + CHUNK_CHARS, clean.length);

        if (end < clean.length) {
            const window = clean.slice(start, end);
            const lastBreak = Math.max(window.lastIndexOf('. '), window.lastIndexOf('.\n'), window.lastIndexOf('\n'));
            if (lastBreak > CHUNK_CHARS * 0.5) {
                end = start + lastBreak + 1;
            }
        }

        chunks.push(clean.slice(start, end).trim());
        if (end >= clean.length) break;
        start = Math.max(end - CHUNK_OVERLAP, start + 1);
    }

    return chunks.filter(Boolean);
}
