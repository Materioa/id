export const SESSION_COOKIE_NAME: string;

export function isProductionDomain(hostOrOrigin?: string): boolean;

export interface SessionCookieOptions {
  path: string;
  domain?: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  maxAge: number;
}

export function getSessionCookieOptions(hostOrOrigin?: string, maxAgeDays?: number): SessionCookieOptions;

export function setSessionCookie(
  cookies: { set: (name: string, value: string, opts: any) => void },
  token: string,
  hostOrOrigin?: string,
  maxAgeDays?: number
): void;

export function clearSessionCookie(
  cookies: { delete: (name: string, opts?: any) => void },
  hostOrOrigin?: string
): void;

export function getClientCookie(name?: string): string | null;

export function setClientCookie(name?: string, value?: string, days?: number): void;

export function clearClientCookie(name?: string): void;
