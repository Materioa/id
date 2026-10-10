import { json, type RequestHandler } from '@sveltejs/kit';
import { AUTH_URL } from '$lib/server/insightroom-auth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { headers: corsHeaders });
};

/**
 * Dynamic Client Registration (RFC 7591), proxied to Materio ID.
 */
export const POST: RequestHandler = async ({ request, fetch, getClientAddress }) => {
  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_client_metadata', error_description: 'Body must be JSON' }, { status: 400, headers: corsHeaders });
  }

  if (!Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
    return json({
      error: 'invalid_client_metadata',
      error_description: 'redirect_uris is required and must be a non-empty array'
    }, { status: 400, headers: corsHeaders });
  }

  let ip = request.headers.get('x-forwarded-for') || '';
  if (!ip) {
    try {
      ip = getClientAddress();
    } catch {}
  }

  try {
    const res = await fetch(`${AUTH_URL}/api/v2/auth?action=oauth_register_app`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ip ? { 'x-forwarded-for': ip } : {})
      },
      body: JSON.stringify({ scope: 'openid profile email offline_access admin', ...body })
    });
    const data = await res.json().catch(() => ({ error: 'server_error' }));
    return json(data, { status: res.status, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('[client registration proxy]', err.message);
    return json({ error: 'server_error', error_description: 'Auth server unreachable' }, { status: 502, headers: corsHeaders });
  }
};
