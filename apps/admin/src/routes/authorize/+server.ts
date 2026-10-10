import type { RequestHandler } from '@sveltejs/kit';
import { AUTH_URL } from '$lib/server/insightroom-auth';

/**
 * MCP clients (Claude etc.) expect the authorization endpoint on the same origin
 * as the resource. Forward the browser to Materio ID's consent page.
 */
export const GET: RequestHandler = async ({ url }) => {
  const target = new URL(`${AUTH_URL}/authorize`);
  for (const [key, value] of url.searchParams) {
    target.searchParams.append(key, value);
  }
  if (!target.searchParams.has('resource')) {
    target.searchParams.set('resource', `${url.origin}/mcp`);
  }

  return new Response(null, { status: 302, headers: { Location: target.toString() } });
};
