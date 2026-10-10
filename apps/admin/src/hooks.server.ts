import type { Handle } from '@sveltejs/kit';
import { closeRequestMongo } from '$lib/server/mongo';
import { autoTriageAllPendingBugReports } from '$lib/server/support-service';

// Background poller: automatically triage new incoming bug reports in local dev only
let pollerInterval: any = null;
if (import.meta.env.DEV && typeof setInterval !== 'undefined' && !pollerInterval) {
  pollerInterval = setInterval(() => {
    autoTriageAllPendingBugReports().catch((err: any) => {
      console.error('[Background Poller] Auto-triage error:', err?.message || err);
    });
  }, 30000); // Check every 30 seconds
}

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

export const handleError = ({ error, event }: any) => {
  console.error('[Admin Server Error]', event.url.pathname, error);
  return {
    message: error instanceof Error ? error.message : String(error)
  };
};
