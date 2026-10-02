/**
 * Mongo client options, kept free of SvelteKit imports so they can be
 * constructed in a test. The MongoClient constructor throws on any option it
 * doesn't recognise, which is a nasty thing to discover at request time in
 * production — `scripts/test-mongo-options.ts` builds a client from this
 * object so a typo fails fast in CI instead.
 *
 * Verified against mongodb driver v7 (`connection_string.js`).
 */
export function mongoOptions(dev) {
  return {
    // Keep a small pool warm; serverless isolates are low-concurrency.
    maxPoolSize: 8,
    minPoolSize: dev ? 0 : 1,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 8000,
    // Recycle sockets well before an intermediary drops them.
    // The driver option is maxIdleTimeMS — there is no `idleTimeoutMS` in v7.
    maxIdleTimeMS: 60_000,
    retryWrites: true,
    retryReads: true
  };
}