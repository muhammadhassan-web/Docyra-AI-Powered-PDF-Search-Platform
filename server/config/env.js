import { z } from 'zod';
import { logger } from '../utils/logger.js';

const envSchema = z.object({
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
    CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN is required'),
    CLOUDINARY_CLOUD_NAME: z.string().min(1, 'CLOUDINARY_CLOUD_NAME is required'),
    CLOUDINARY_API_KEY: z.string().min(1, 'CLOUDINARY_API_KEY is required'),
    CLOUDINARY_API_SECRET: z.string().min(1, 'CLOUDINARY_API_SECRET is required'),
    GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
    GEMINI_MODEL: z.string().optional(),
    GEMINI_EMBEDDING_MODEL: z.string().optional(),
    GEMINI_EMBEDDING_DIMENSIONS: z.string().optional(),
    PORT: z.string().optional(),
    NODE_ENV: z.string().optional(),
});

export function validateEnv() {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
        const issues = result.error.issues.map(issue => `  - ${issue.path.join('.')}: ${issue.message}`);
        logger.error({ issues }, 'Invalid environment configuration');
        process.exit(1);
    }
}
