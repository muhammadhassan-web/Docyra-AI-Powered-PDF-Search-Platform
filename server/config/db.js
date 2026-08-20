import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

export default async function connectDB() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error('MONGODB_URI is not set');
    }

    await mongoose.connect(uri);
    logger.info('Database connected');
}
