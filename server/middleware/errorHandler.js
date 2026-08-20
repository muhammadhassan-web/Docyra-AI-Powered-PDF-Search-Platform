export function errorHandler(err, req, res, next) {
    (req.log || console).error({ err }, 'Request error');
    if (res.headersSent) return next(err);

    const status = err.status || 500;
    const isProd = process.env.NODE_ENV === 'production';

    // Unexpected 500s: never leak internal error details to the client in production.
    const message = status < 500 || !isProd
        ? (err.message || 'Internal server error')
        : 'Internal server error';

    res.status(status).json({ error: message });
}
