export const SESSION_TTL_DAYS: number;
export const SESSION_TTL_SECONDS: number;
export const SESSION_TTL_MS: number;
export const SESSION_TOUCH_INTERVAL_MS: number;
export function sessionExpiresAt(session: { created_at?: string | null } | null | undefined): Date | null;
export function isSessionExpired(session: { created_at?: string | null } | null | undefined, now?: number): boolean;
declare const _default: {
  SESSION_TTL_DAYS: number;
  SESSION_TTL_SECONDS: number;
  SESSION_TTL_MS: number;
  SESSION_TOUCH_INTERVAL_MS: number;
  sessionExpiresAt: typeof sessionExpiresAt;
  isSessionExpired: typeof isSessionExpired;
};
export default _default;
