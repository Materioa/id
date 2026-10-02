import { MongoClient, Db } from 'mongodb';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { dev } from '$app/environment';
import { mongoOptions } from '@materio/config/mongo-options';

try {
  const dns = await import('node:dns');
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {}

const uri = env.MONGODB_URI || publicEnv.PUBLIC_MONGODB_URI;

if (!uri) {
  throw new Error('Please add your Mongo URI to .env');
}

const DB_NAME = 'materio';

/**
 * One client per isolate, reused for the life of that isolate.
 *
 * This used to open a brand new MongoClient on every request in production,
 * so each call paid a full TCP + TLS handshake before it could read a single
 * document. The driver already heartbeats the connection and reconnects on
 * its own, so holding it open is safe; the retry below covers the one case it
 * can't fix on its own, a topology that was closed while the isolate was idle.
 *
 * Cached on globalThis in dev so hot reloads don't pile up clients.
 */
type Cache = { _mongo?: MongoClient; _mongoConnecting?: Promise<MongoClient> };
const cache = globalThis as typeof globalThis & Cache;

const OPTIONS = mongoOptions(dev);

function createClient(): Promise<MongoClient> {
  const client = new MongoClient(uri, OPTIONS);
  cache._mongo = client;
  const connecting = client.connect();
  cache._mongoConnecting = connecting;
  // A failed first connect must not leave a dead client cached forever.
  connecting.catch(() => {
    if (cache._mongo === client) {
      cache._mongo = undefined;
      cache._mongoConnecting = undefined;
    }
  });
  return connecting;
}

function clientPromise(): Promise<MongoClient> {
  return cache._mongoConnecting || createClient();
}

/** True when an error is worth retrying on a fresh connection. */
function isConnectionError(err: any) {
  const name = String(err?.name || '');
  const msg = String(err?.message || '');
  return (
    /MongoNetworkError|MongoServerSelectionError|MongoNotConnectedError|PoolClearedError|MongoTopologyClosedError/.test(name) ||
    /connection .* closed|server selection|ECONNRESET|ECONNREFUSED|socket hang up|connection timed out/i.test(msg)
  );
}

export async function getDb(): Promise<Db> {
  try {
    const client = await clientPromise();
    return client.db(DB_NAME);
  } catch (err) {
    if (!isConnectionError(err)) throw err;
    // Stale topology: drop the cached client and try exactly once more.
    try { await cache._mongo?.close(true); } catch { /* already gone */ }
    cache._mongo = undefined;
    cache._mongoConnecting = undefined;
    const client = await clientPromise();
    return client.db(DB_NAME);
  }
}

export { clientPromise };