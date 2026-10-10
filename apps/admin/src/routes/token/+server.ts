import { json, type RequestHandler } from '@sveltejs/kit';
import { AUTH_URL } from '$lib/server/insightroom-auth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { headers: corsHeaders });
};

/**
 * Token proxy to Materio ID. Supports authorization_code and refresh_token grants.
 */
export const POST: RequestHandler = async ({ request, fetch, url }) => {
  const contentType = request.headers.get('content-type') || '';
  let body: Record<string, any>;
  try {
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      body = Object.fromEntries(await request.formData());
    } else {
      return json({ error: 'invalid_request', error_description: 'Unsupported content type' }, { status: 400, headers: corsHeaders });
    }
  } catch {
    return json({ error: 'invalid_request', error_description: 'Malformed body' }, { status: 400, headers: corsHeaders });
  }

  if (!body.resource) body.resource = `${url.origin}/mcp`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const authorization = request.headers.get('authorization');
  if (authorization) headers.Authorization = authorization;

  try {
    const res = await fetch(`${AUTH_URL}/api/v2/auth?action=oauth_token`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({ error: 'server_error' }));
    return json(data, {
      status: res.status,
      headers: { ...corsHeaders, 'Cache-Control': 'no-store', Pragma: 'no-cache' }
    });
  } catch (err: any) {
    console.error('[token proxy]', err.message);
    return json({ error: 'server_error', error_description: 'Auth server unreachable' }, { status: 502, headers: corsHeaders });
  }
};
