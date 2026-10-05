import { json } from '@sveltejs/kit';
import { buildOAuthMetadata } from '$lib/server/oauth-metadata';

/**
 * RFC 8414 §3.1 authorization server metadata.
 * Previously this path 404'd (SvelteKit HTML shell), so MCP clients could not
 * discover Materio ID and fell back to guessing endpoints.
 */
export async function GET({ request }: { request: Request }) {
  return json(buildOAuthMetadata(request), {
    headers: { 'Cache-Control': 'public, max-age=3600' }
  });
}