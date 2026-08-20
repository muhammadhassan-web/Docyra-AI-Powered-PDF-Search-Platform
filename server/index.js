import 'dotenv/config';
import mongoose from 'mongoose';

import { validateEnv } from './config/env.js';
import connectDB from './config/db.js';
import { logger } from './utils/logger.js';
import { closePdfWorkerPool } from './utils/pdfWorkerPool.js';
import { createApp } from './app.js';

validateEnv();

const app = createApp();
const PORT = process.env.PORT || 5000;

let server;

connectDB()
    .then(() => {
        server = app.listen(PORT, () => logger.info(`DOCYRA API listening on port ${PORT}`));
    })
    .catch(err => {
        logger.error({ err }, 'Failed to connect to database');
        process.exit(1);
    });

async function shutdown(signal) {
    logger.info({ signal }, 'Shutdown signal received, draining connections');
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
    try {
        await mongoose.connection.close(false);
    } catch (err) {
        logger.error({ err }, 'Error closing database connection during shutdown');
    }
    await closePdfWorkerPool();
    logger.info('Shutdown complete');
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
