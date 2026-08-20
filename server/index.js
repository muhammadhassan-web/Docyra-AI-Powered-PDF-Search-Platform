import 'dotenv/config';
import dns from 'dns';
import mongoose from 'mongoose';

import { validateEnv } from './config/env.js';
import connectDB from './config/db.js';
import { logger } from './utils/logger.js';
import { closePdfWorkerPool } from './utils/pdfWorkerPool.js';
import { createApp } from './app.js';

// Render's network has no outbound IPv6 route, but Node's default DNS
// lookup order can still return/prefer AAAA (IPv6) records for hosts like
// smtp.gmail.com, which then fail to connect with ENETUNREACH — seen in
// production for password-reset emails. Preferring IPv4 results process-wide
// avoids that for every outbound connection (SMTP, and anything else).
dns.setDefaultResultOrder('ipv4first');

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
