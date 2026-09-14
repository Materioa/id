/**
 * Resolves cross-app URLs dynamically based on the current window location or environment.
 * In development:
 *   accounts: http://localhost:5173
 *   auth:     http://localhost:5174
 *   admin:    http://localhost:5175
 * In production:
 *   accounts: https://accounts.getmaterio.app
 *   auth:     https://auth.getmaterio.app
 *   admin:    https://admin.getmaterio.app
 */

export function getAppUrls(currentOrigin) {
  let isLocal = false;
  if (currentOrigin) {
    isLocal = currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1');
  } else if (typeof window !== 'undefined') {
    isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }

  if (isLocal) {
    return {
      accounts: 'http://localhost:5173',
      auth: 'http://localhost:5174',
      admin: 'http://localhost:5175'
    };
  }

  return {
    accounts: 'https://accounts.getmaterio.app',
    auth: 'https://auth.getmaterio.app',
    admin: 'https://admin.getmaterio.app'
  };
}

export default getAppUrls;
