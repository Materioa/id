import { json } from '@sveltejs/kit';
import { buildOAuthMetadata } from '$lib/server/oauth-metadata';

/** OIDC discovery (OpenID Connect Discovery 1.0 §4). */
export async function GET({ request }: { request: Request }) {
  return json(buildOAuthMetadata(request, true), {
    headers: { 'Cache-Control': 'public, max-age=3600' }
  });
}