import { json } from '@sveltejs/kit';
import { SESSION_COOKIE_NAME, clearSessionCookie } from '@materio/config';
import { revokeSessionToken } from '$lib/server/utils';

/**
 * DELETE /api/v2/session — end the caller's own login session.
 *
 * Logging out used to only clear the cookie/localStorage in the browser, so
 * the user_sessions row stayed behind and showed up as "active" forever in
 * Accounts → Security. The logout page calls this first.
 *
 * Token comes from the Authorization header, falling back to the shared
 * `materio_token` cookie (same-site across *.getmaterio.app / localhost).
 */
export async function DELETE({ request, cookies, url }) {
  const header = request.headers.get('authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const cookieToken = cookies.get(SESSION_COOKIE_NAME) || '';

  const tokens = [...new Set([bearer, cookieToken].filter(Boolean))];
  let revoked = false;
  for (const t of tokens) revoked = (await revokeSessionToken(t)) || revoked;

  clearSessionCookie(cookies, url.origin);
  return json({ success: true, revoked });
}
