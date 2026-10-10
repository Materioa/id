/**
 * Single source of truth for how long a Materio login lasts.
 *
 * The JWT lifetime, the shared `materio_token` cookie lifetime and the
 * server-side `user_sessions` row lifetime must all agree. They used to be
 * 24h (JWT) vs 7d (cookie) vs forever (DB row), which is why people got
 * logged out after a day while Accounts → Security kept listing every
 * session they had ever opened.
 */

/** Absolute lifetime of a login (JWT `exp`, cookie max-age). */
export const SESSION_TTL_DAYS = 30;
export const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

/** How often a session's `last_active_at` is bumped while it's being used. */
export const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * When a `user_sessions` row stops being valid. Uses the absolute TTL from
 * creation, because that is when the JWT it backs expires.
 */
export function sessionExpiresAt(session) {
  const created = Date.parse(session?.created_at || '');
  if (Number.isNaN(created)) return null;
  return new Date(created + SESSION_TTL_MS);
}

export function isSessionExpired(session, now = Date.now()) {
  const exp = sessionExpiresAt(session);
  return exp ? exp.getTime() <= now : false;
}

export default {
  SESSION_TTL_DAYS,
  SESSION_TTL_SECONDS,
  SESSION_TTL_MS,
  SESSION_TOUCH_INTERVAL_MS,
  sessionExpiresAt,
  isSessionExpired
};
