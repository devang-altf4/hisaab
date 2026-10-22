/** Print document counts for every collection in the configured MongoDB database (read-only). */
import { existsSync } from 'node:fs';
import mongoose from 'mongoose';

if (existsSync('.env')) process.loadEnvFile('.env');
await mongoose.connect(process.env.MONGODB_URI ?? '', { dbName: process.env.MONGODB_DATABASE, serverSelectionTimeoutMS: 10000 });
const db = mongoose.connection.db!;
for (const { name } of await db.listCollections().toArray()) {
  console.log(`${name}: ${await db.collection(name).countDocuments()}`);
}
await mongoose.disconnect();
