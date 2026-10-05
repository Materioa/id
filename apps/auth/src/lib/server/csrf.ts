import { json } from '@sveltejs/kit';

/**
 * Same-origin guard for cookie-authenticated, state-changing endpoints.
 *
 * SvelteKit's built-in `csrf.checkOrigin` had to be disabled app-wide because
 * the OAuth token endpoint must accept `application/x-www-form-urlencoded`
 * POSTs from non-browser clients (RFC 6749 section 4.1.3) which legitimately
 * send no `Origin` header. Every endpoint that trusts the Materio session
 * cookie must therefore re-implement the check here.
 *
 * A missing `Origin` is treated as allowed: browsers always attach `Origin` to
 * cross-site POSTs, so an attacker page cannot forge its absence. Non-browser
 * clients (native apps, curl, server-to-server) also omit it, and they cannot
 * be CSRF targets because they do not carry the victim's session cookie.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!host) return false;

  // Compare hosts rather than full origins: the scheme is not reliably
  // observable here (no x-forwarded-proto on plain HTTP origins, e.g. local
  // preview), and an attacker page cannot share our host anyway.
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * @returns a 403 Response when the request is cross-site, otherwise null
 */
export function csrfGuard(req: Request): Response | null {
  if (isSameOrigin(req)) return null;
  return json(
    { error: 'invalid_request', error_description: 'Cross-site request forbidden' },
    { status: 403 }
  );
}