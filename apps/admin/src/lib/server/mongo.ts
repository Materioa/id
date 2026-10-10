import { MongoClient, Db } from 'mongodb';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { dev } from '$app/environment';
import { getRequestEvent } from '$app/server';
import type { RequestEvent } from '@sveltejs/kit';
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
const OPTIONS = mongoOptions(dev);

/**
 * Connection lifecycle.
 *
 * DEV (Node / Vite): one client cached on globalThis so hot reloads don't pile
 * up clients. Node is happy to share sockets between requests.
 *
 * PRODUCTION (Cloudflare Workers): one client PER REQUEST, closed when the
 * request finishes (see `closeRequestMongo` in hooks.server.ts).
 *
 * A previous version cached a single client per isolate in production too.
 * Workers forbid that: a socket opened while handling request A cannot be
 * used while handling request B ("Cannot perform I/O on behalf of a different
 * request"). The second request on a warm isolate would hang until Cloudflare
 * killed it and served its own HTML 500 page — which is what the admin
 * promotions page was showing. Within a single request every getDb() call
 * shares the same client, so a handler doing several queries still only pays
 * one handshake.
 */
type Cache = { _mongo?: MongoClient; _mongoConnecting?: Promise<MongoClient> };
const cache = globalThis as typeof globalThis & Cache;

/** Per-request clients (production only). Keyed by the SvelteKit RequestEvent. */
const requestClients = new WeakMap<RequestEvent, { client: MongoClient; connecting: Promise<MongoClient> }>();

function connectFresh(): { client: MongoClient; connecting: Promise<MongoClient> } {
  const client = new MongoClient(uri, { ...OPTIONS, minPoolSize: 0 });
  return { client, connecting: client.connect() };
}

function devClientPromise(): Promise<MongoClient> {
  if (cache._mongoConnecting) return cache._mongoConnecting;
  const { client, connecting } = connectFresh();
  cache._mongo = client;
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

function currentEvent(): RequestEvent | null {
  try {
    return getRequestEvent();
  } catch {
    return null; // called outside a request (e.g. module init)
  }
}

function prodClientPromise(): Promise<MongoClient> {
  const event = currentEvent();
  if (!event) return connectFresh().connecting;

  let entry = requestClients.get(event);
  if (!entry) {
    entry = connectFresh();
    requestClients.set(event, entry);
    entry.connecting.catch(() => requestClients.delete(event));
  }
  return entry.connecting;
}

function clientPromise(): Promise<MongoClient> {
  return dev ? devClientPromise() : prodClientPromise();
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

export async function getDb(dbName: string = DB_NAME): Promise<Db> {
  try {
    const client = await clientPromise();
    return client.db(dbName);
  } catch (err) {
    if (!isConnectionError(err)) throw err;
    // Stale topology (dev) or a failed handshake: drop it and try exactly once more.
    if (dev) {
      try { await cache._mongo?.close(true); } catch { /* already gone */ }
      cache._mongo = undefined;
      cache._mongoConnecting = undefined;
    }
    const client = await clientPromise();
    return client.db(dbName);
  }
}

export async function getInsightroomDb(): Promise<Db> {
  return getDb('insightroom');
}

/**
 * Close the client opened for this request, if any. Called from the `handle`
 * hook once the response has been produced; the close is handed to
 * `waitUntil` so it never delays the response.
 */
export function closeRequestMongo(event: RequestEvent) {
  const entry = requestClients.get(event);
  if (!entry) return;
  requestClients.delete(event);
  const closing = entry.connecting
    .then((c) => c.close())
    .catch(() => { /* connect failed or already closed */ });
  const ctx: any = (event.platform as any)?.ctx ?? (event.platform as any)?.context;
  if (ctx?.waitUntil) ctx.waitUntil(closing);
}

export { clientPromise };