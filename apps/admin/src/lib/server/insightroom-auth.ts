import { env } from '$env/dynamic/private';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';

export const SESSION_COOKIE = 'materio_token';
export const LEGACY_SESSION_COOKIE = 'token';
export const AUTH_URL = (env.AUTH_URL || process.env.AUTH_URL || 'https://auth.getmaterio.app').replace(/\/$/, '');

export function getCookieToken(cookies: { get: (name: string) => string | undefined }): string {
  return cookies.get(SESSION_COOKIE) || cookies.get(LEGACY_SESSION_COOKIE) || '';
}

/**
 * Validates token and checks if user has super/admin privileges.
 * First tries internal verification with Supabase (fast, no HTTP roundtrip).
 * Falls back to AUTH_URL /api/v2/profile if external.
 */
export async function validateToken(
  token: string | undefined,
  fetchFn?: typeof fetch
): Promise<{ user: any; accessTier: 'super' | 'plus' | 'normal' | 'guest' }> {
  const guest = { user: null, accessTier: 'guest' as const };
  if (!token) return guest;

  // 1. Try local verifyToken
  try {
    const decoded = await verifyToken(token);
    if (decoded && decoded.id) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id, username, display_name, email, profile_picture, has_admin_privileges, is_plus_user, is_banned')
        .eq('id', decoded.id)
        .maybeSingle();

      if (user && !user.is_banned) {
        const isAdmin = user.has_admin_privileges === true;
        const isPlus = user.is_plus_user === true;
        return {
          user: {
            id: user.id,
            username: user.username,
            displayName: user.display_name || user.username,
            email: user.email,
            profilePicture: user.profile_picture,
            hasAdminPrivileges: isAdmin,
            isPlusUser: isPlus
          },
          accessTier: isAdmin ? 'super' : isPlus ? 'plus' : 'normal'
        };
      }
    }
  } catch {}

  // 2. Fallback to auth server profile check
  if (fetchFn) {
    try {
      const res = await fetchFn(`${AUTH_URL}/api/v2/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const body = (await res.json()) as any;
        const raw = body.user || body;
        if (raw?.id && !body.suspended && !raw.isBanned) {
          const isAdmin = Boolean(raw.hasAdminPrivileges || raw.has_admin_privileges);
          const isPlus = Boolean(raw.isPlusUser || raw.is_plus_user);
          return {
            user: {
              id: raw.id,
              username: raw.username,
              displayName: raw.displayName || raw.display_name || raw.username,
              email: raw.email,
              profilePicture: raw.profilePicture || raw.profile_picture,
              hasAdminPrivileges: isAdmin,
              isPlusUser: isPlus
            },
            accessTier: isAdmin ? 'super' : isPlus ? 'plus' : 'normal'
          };
        }
      }
    } catch {}
  }

  return guest;
}
