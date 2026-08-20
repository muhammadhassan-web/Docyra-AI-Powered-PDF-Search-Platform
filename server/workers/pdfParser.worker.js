import { parentPort } from 'node:worker_threads';
import pdf from 'pdf-parse-fork';

// Runs off the main event loop so a large/complex PDF doesn't stall requests
// for every other tenant sharing this Node process. See utils/pdfWorkerPool.js.
parentPort.on('message', async ({ id, buffer }) => {
    try {
        const pdfData = await pdf(Buffer.from(buffer));
        const text = pdfData.text.replace(/\s+/g, ' ').trim();
        parentPort.postMessage({ id, text });
    } catch (err) {
        parentPort.postMessage({ id, error: err.message || 'Failed to parse PDF' });
    }
});
