import { json } from '@sveltejs/kit';

/**
 * Minimal CORS for browser calls from the landing/marketing site
 * (getmaterio.app, *.getmaterio.app, localhost, Tauri) to these APIs.
 * Auth uses Bearer tokens (no cookies), so no credentials flag is needed.
 */

const STATIC_ALLOWED = [
  'https://getmaterio.app',
  'https://www.getmaterio.app',
  'https://materioa.netlify.app',
  'https://materioa.vercel.app',
  'https://materioapp.in',
  'https://room.getmaterio.app',
  'https://tauri.localhost',
  'http://tauri.localhost',
  'tauri://localhost'
];

function isAllowed(origin: string): boolean {
  if (!origin) return false;
  if (STATIC_ALLOWED.includes(origin)) return true;
  if (origin === 'https://getmaterio.app' || origin.endsWith('.getmaterio.app')) return true;
  if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return true;
  if (origin.startsWith('tauri://')) return true;
  return false;
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || '';
  if (origin && isAllowed(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type'
    };
  }
  return {};
}

/** JSON response with CORS headers. */
export function corsJson(request: Request, data: unknown, status = 200): Response {
  return json(data, { status, headers: corsHeaders(request) });
}

/** Preflight handler: `export async function OPTIONS({ request }: any)`. */
export function handleOptions(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
