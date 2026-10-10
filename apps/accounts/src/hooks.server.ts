import type { Handle } from '@sveltejs/kit';
import { closeRequestMongo } from '$lib/server/mongo';

/**
 * Releases the per-request MongoDB client once the response is ready.
 * See $lib/server/mongo.ts for why production can't reuse one across requests.
 */
export const handle: Handle = async ({ event, resolve }) => {
  try {
    return await resolve(event);
  } finally {
    closeRequestMongo(event);
  }
};
