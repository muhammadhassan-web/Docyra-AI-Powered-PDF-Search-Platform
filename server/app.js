import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';

import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import authRoutes from './routes/auth.routes.js';
import policiesRoutes from './routes/policies.routes.js';
import uploadsRoutes from './routes/uploads.routes.js';
import chatRoutes from './routes/chat.routes.js';
import organizationRoutes from './routes/organization.routes.js';

// Pure Express app construction, with no side effects (no env validation, no
// DB connection, no listen()) so integration tests can import and exercise
// it directly against an isolated database. See index.js for the process
// entrypoint that actually boots this.
export function createApp() {
    const app = express();

    // Render sits behind Cloudflare, so every request arrives through two
    // reverse proxies (Cloudflare edge, then Render's own) before reaching
    // this process — X-Forwarded-For has two proxy hops appended ahead of
    // the real client IP. Without telling Express how many hops to trust,
    // express-rate-limit's IP validation treats that header shape as
    // untrustworthy/spoofed and throws (ERR_ERL_UNEXPECTED_X_FORWARDED_FOR),
    // which hangs the request instead of responding — this silently broke
    // every rate-limited /api/auth request (register, login, forgot-password).
    app.set('trust proxy', 2);

    app.use(pinoHttp({
        logger,
        genReqId: (req, res) => {
            const id = req.headers['x-request-id'] || randomUUID();
            res.setHeader('X-Request-Id', id);
            return id;
        },
        customProps: (req) => ({
            organizationId: req.user?.organizationId,
            userId: req.user?._id,
        }),
        autoLogging: { ignore: (req) => req.url === '/api/health' },
    }));

    const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean);

    app.use(helmet());
    app.use(cors({
        origin: allowedOrigins.length ? allowedOrigins : false,
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type'],
    }));
    app.use(express.json());
    app.use(cookieParser());

    // Pre-auth: only an IP key is available. Chat/upload limits are applied
    // per-user/org inside their own route files, after requireAuth runs.
    // Configurable so integration tests (many auth calls from one "IP" in the
    // same process) can raise it without weakening the production default.
    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: Number(process.env.AUTH_RATE_LIMIT) || 20,
        standardHeaders: true,
        legacyHeaders: false,
    });

    app.use('/api/auth', authLimiter, authRoutes);
    app.use('/api/policies', policiesRoutes);
    app.use('/api/uploads', uploadsRoutes);
    app.use('/api/chat', chatRoutes);
    app.use('/api/organization', organizationRoutes);

    app.get('/api/health', (req, res) => {
        const dbConnected = mongoose.connection.readyState === 1;
        res.status(dbConnected ? 200 : 503).json({ status: dbConnected ? 'ok' : 'degraded', db: dbConnected ? 'connected' : 'disconnected' });
    });

    // Liveness: process is up and can serve HTTP, regardless of dependencies.
    app.get('/api/health/live', (req, res) => {
        res.status(200).json({ status: 'ok' });
    });

    app.use(errorHandler);

    return app;
}
