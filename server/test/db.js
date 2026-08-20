import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let replSet;

// A single-node replica set (not a standalone) so tests can exercise routes
// that use Mongoose transactions (see auth.routes.js register).
export async function startTestDB() {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri());
}

export async function stopTestDB() {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
}

export async function clearTestDB() {
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
        await collections[key].deleteMany({});
    }
}
