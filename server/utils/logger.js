import pino from 'pino';

const isProd = process.env.NODE_ENV === 'production';

// Plain JSON logs everywhere — pipe through `pino-pretty` locally if you want
// colorized output (`node server/index.js | npx pino-pretty`) rather than
// depending on it as a runtime dependency.
export const logger = pino({
    level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
    redact: ['req.headers.cookie', 'req.headers.authorization'],
});
