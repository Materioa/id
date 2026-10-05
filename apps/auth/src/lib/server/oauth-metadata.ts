import { env } from '$env/dynamic/private';

/**
 * Single source of truth for Materio ID's OAuth 2.0 / OIDC discovery documents.
 *
 * Both `GET /.well-known/oauth-authorization-server`,
 * `GET /.well-known/openid-configuration` and the legacy
 * `GET /api/v2/auth?action=oauth_metadata|oidc_metadata` route render from here,
 * so they can never drift apart. Discovery must be served from the issuer's own
 * host: clients resolve the authorization server from the issuer identifier and
 * then fetch these documents relative to it (RFC 8414 §3.1, RFC 9728 §3.1).

/** Scopes Materio ID actually honours, including the gated Pro/Plus tiers. */
export const OAUTH_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'admin',
  'pro',
  'plus',
  'subscription'
];

export function resolveIssuer(req: Request): string {
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  return env.OAUTH_ISSUER || (host ? `${proto}://${host}` : 'https://getmaterio.app');
}

export function resolveAuthBaseUrl(req: Request): string {
  return env.OAUTH_PUBLIC_BASE_URL || resolveIssuer(req);
}

/**
 * @param oidc include the OIDC-only fields (claims, subject types, signing algs)
 */
export function buildOAuthMetadata(req: Request, oidc = false) {
  const issuer = resolveIssuer(req);
  const baseUrl = resolveAuthBaseUrl(req);
  // Every endpoint below must live under the issuer (RFC 8414 §3.3).
  const authApi = `${baseUrl}/api/v2/auth`;

  const metadata: Record<string, unknown> = {
    issuer,
    // /authorize is the real login + consent page. There is no /account/sso
    // route — pointing there yields a 404 HTML shell.
    authorization_endpoint: `${baseUrl}/authorize`,
    token_endpoint: authApi,
    jwks_uri: `${authApi}?action=jwks`,
    registration_endpoint: `${authApi}?action=oauth_register_app`,
    revocation_endpoint: `${authApi}?action=oauth_revoke`,
    introspection_endpoint: `${authApi}?action=oauth_introspect`,
    userinfo_endpoint: `${authApi}?action=userinfo`,
    end_session_endpoint: `${authApi}?action=logout`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: OAUTH_SCOPES
  };

  if (oidc) {
    metadata.claims_supported = ['sub', 'email', 'email_verified', 'preferred_username', 'name', 'picture', 'auth_time'];
    metadata.subject_types_supported = ['public'];
    metadata.id_token_signing_alg_values_supported = [
      env.OIDC_PRIVATE_KEY || env.OIDC_PRIVATE_KEY_B64 ? 'RS256' : 'HS256'
    ];
  }

  return metadata;
}