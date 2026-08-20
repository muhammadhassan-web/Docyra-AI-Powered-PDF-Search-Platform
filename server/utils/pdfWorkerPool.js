import { Worker } from 'node:worker_threads';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = path.join(__dirname, '..', 'workers', 'pdfParser.worker.js');
const POOL_SIZE = Math.max(1, Math.min(4, os.cpus().length - 1));
const PARSE_TIMEOUT_MS = 30_000;

const idleWorkers = [];
const allWorkers = new Set();
const queue = [];
const pending = new Map(); // taskId -> { resolve, reject, timer, worker }

function spawnWorker() {
    const worker = new Worker(WORKER_PATH);
    allWorkers.add(worker);
    worker.once('exit', () => allWorkers.delete(worker));
    worker.on('message', ({ id, text, error }) => {
        const task = pending.get(id);
        if (!task) return;
        pending.delete(id);
        clearTimeout(task.timer);
        if (error) task.reject(Object.assign(new Error(error), { status: 400 }));
        else task.resolve(text);
        releaseWorker(worker);
    });
    worker.on('error', (err) => {
        logger.error({ err }, 'PDF parser worker crashed');
        for (const [id, task] of pending) {
            if (task.worker === worker) {
                pending.delete(id);
                clearTimeout(task.timer);
                task.reject(Object.assign(new Error('PDF parsing failed'), { status: 500 }));
            }
        }
        const idleIdx = idleWorkers.indexOf(worker);
        if (idleIdx !== -1) idleWorkers.splice(idleIdx, 1);
        idleWorkers.push(spawnWorker()); // keep pool at fixed capacity
        dispatch();
    });
    return worker;
}

function releaseWorker(worker) {
    idleWorkers.push(worker);
    dispatch();
}

function dispatch() {
    if (queue.length === 0) return;
    const worker = idleWorkers.pop();
    if (!worker) return; // no idle worker; will be picked up when one frees
    const { id, buffer, resolve, reject } = queue.shift();
    const timer = setTimeout(() => {
        pending.delete(id);
        reject(Object.assign(new Error('PDF parsing timed out'), { status: 400 }));
        worker.terminate();
        idleWorkers.splice(idleWorkers.indexOf(worker), 1);
    }, PARSE_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer, worker });
    worker.postMessage({ id, buffer });
}

let initialized = false;
function ensurePool() {
    if (initialized) return;
    initialized = true;
    for (let i = 0; i < POOL_SIZE; i++) idleWorkers.push(spawnWorker());
}

export function extractPdfText(buffer) {
    ensurePool();
    return new Promise((resolve, reject) => {
        const id = randomUUID();
        queue.push({ id, buffer, resolve, reject });
        dispatch();
    });
}

export async function closePdfWorkerPool() {
    await Promise.all([...allWorkers].map((worker) => worker.terminate()));
}
