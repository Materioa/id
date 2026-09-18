/**
 * Shared session cookie utilities across Materio applications.
 * 
 * In development (localhost):
 *   Cookies are set on Path=/ with no domain restriction.
 *   Under RFC 6265, browsers share cookies across all ports on localhost
 *   (5173, 5174, 5175, etc.).
 * 
 * In production (getmaterio.app):
 *   Cookies are set with Domain=.getmaterio.app, Path=/, Secure=true.
 *   This shares sessions automatically across auth.getmaterio.app,
 *   accounts.getmaterio.app, admin.getmaterio.app, and all subdomains.
 */

export const SESSION_COOKIE_NAME = 'materio_token';

export function isProductionDomain(hostOrOrigin) {
  if (!hostOrOrigin) {
    if (typeof window !== 'undefined') {
      return window.location.hostname.includes('getmaterio.app');
    }
    return false;
  }
  return hostOrOrigin.includes('getmaterio.app');
}

export function getSessionCookieOptions(hostOrOrigin, maxAgeDays = 7) {
  const isProd = isProductionDomain(hostOrOrigin);
  return {
    path: '/',
    domain: isProd ? '.getmaterio.app' : undefined,
    secure: isProd,
    httpOnly: false, // Accessible to both server and client scripts for sync
    sameSite: 'lax',
    maxAge: maxAgeDays * 24 * 60 * 60
  };
}

/**
 * Server-side helper to set session cookie on SvelteKit event.cookies
 */
export function setSessionCookie(cookies, token, hostOrOrigin, maxAgeDays = 7) {
  if (!cookies || !token) return;
  const options = getSessionCookieOptions(hostOrOrigin, maxAgeDays);
  cookies.set(SESSION_COOKIE_NAME, token, options);
}

/**
 * Server-side helper to clear session cookie on SvelteKit event.cookies
 */
export function clearSessionCookie(cookies, hostOrOrigin) {
  if (!cookies) return;
  const isProd = isProductionDomain(hostOrOrigin);
  if (isProd) {
    cookies.delete(SESSION_COOKIE_NAME, { path: '/', domain: '.getmaterio.app' });
  }
  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}

/**
 * Client-side helper to read a cookie
 */
export function getClientCookie(name = SESSION_COOKIE_NAME) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Client-side helper to set a cookie across the ecosystem
 */
export function setClientCookie(name = SESSION_COOKIE_NAME, value, days = 7) {
  if (typeof document === 'undefined') return;
  const isProd = window.location.hostname.includes('getmaterio.app');
  const domainPart = isProd ? '; domain=.getmaterio.app' : '';
  const securePart = isProd ? '; Secure' : '';
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/${domainPart}${securePart}; SameSite=Lax`;
}

/**
 * Client-side helper to delete a cookie across all domain scopes
 */
export function clearClientCookie(name = SESSION_COOKIE_NAME) {
  if (typeof document === 'undefined') return;
  const isProd = window.location.hostname.includes('getmaterio.app');
  const expires = 'Thu, 01 Jan 1970 00:00:00 GMT';
  if (isProd) {
    document.cookie = `${name}=; expires=${expires}; path=/; domain=.getmaterio.app`;
  }
  document.cookie = `${name}=; expires=${expires}; path=/`;
}

export default {
  SESSION_COOKIE_NAME,
  isProductionDomain,
  getSessionCookieOptions,
  setSessionCookie,
  clearSessionCookie,
  getClientCookie,
  setClientCookie,
  clearClientCookie
};
