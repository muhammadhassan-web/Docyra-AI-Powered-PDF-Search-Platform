// Runs before any test file is imported (see vitest.config.ts setupFiles) so
// env-dependent modules (cloudinary.js config) see valid values at import
// time, not just at request time.
process.env.JWT_SECRET ??= 'test-only-jwt-secret-do-not-use-in-prod-32chars';
process.env.CLOUDINARY_CLOUD_NAME ??= 'docyra-demo';
process.env.CLOUDINARY_API_KEY ??= 'test-cloudinary-key';
process.env.CLOUDINARY_API_SECRET ??= 'test-cloudinary-secret';
process.env.GEMINI_API_KEY ??= 'test-gemini-key';
process.env.CORS_ORIGIN ??= 'http://localhost:5173';
process.env.NODE_ENV = 'test';
// Integration tests fire far more than 20 auth requests from one "IP" in a
// single test process — raise the cap so tests exercise route logic instead
// of the rate limiter. Production keeps the real default (see app.js).
process.env.AUTH_RATE_LIMIT ??= '1000';
process.env.EMPLOYEE_LOGIN_RATE_LIMIT ??= '1000';
