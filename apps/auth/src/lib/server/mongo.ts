import { MongoClient, Db } from 'mongodb';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { dev } from '$app/environment';

try {
  const dns = await import('node:dns');
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

const uri = env.MONGODB_URI || publicEnv.PUBLIC_MONGODB_URI;

if (!uri) {
  throw new Error('Please add your Mongo URI to .env');
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (dev) {
  const globalWithMongo = globalThis as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

export async function getDb(): Promise<Db> {
  if (dev) {
    const c = await clientPromise;
    return c.db('materio');
  } else {
    // In serverless environments, create a fresh connection per request
    // to prevent dropped TCP connections from crashing the API.
    const tempClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await tempClient.connect();
    return tempClient.db('materio');
  }
}

export { clientPromise };
