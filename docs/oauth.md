# OAuth 2.0 & OpenID Connect API

Materio is a full OAuth 2.0 Authorization Server with OpenID Connect (OIDC) support. All OAuth endpoints are served from the **`/api/v2/auth`** route using an `action` query/body parameter to dispatch.

---

## Discovery

### OAuth 2.0 Authorization Server Metadata

```
GET /api/v2/auth?action=oauth_metadata
```

### OpenID Connect Discovery

```
GET /api/v2/auth?action=oidc_metadata
```

Returns a standard `.well-known/openid-configuration` style document:

```json
{
  "issuer": "https://accounts.getmaterio.app",
  "authorization_endpoint": "https://accounts.getmaterio.app/account/sso",
  "token_endpoint": "https://accounts.getmaterio.app/api/v2/auth",
  "jwks_uri": "https://accounts.getmaterio.app/api/v2/auth?action=jwks",
  "registration_endpoint": "https://accounts.getmaterio.app/api/v2/auth?action=oauth_register_app",
  "revocation_endpoint": "https://accounts.getmaterio.app/api/v2/auth?action=oauth_revoke",
  "introspection_endpoint": "https://accounts.getmaterio.app/api/v2/auth?action=oauth_introspect",
  "userinfo_endpoint": "https://accounts.getmaterio.app/api/v2/auth?action=userinfo",
  "end_session_endpoint": "https://accounts.getmaterio.app/api/v2/auth?action=logout",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post", "none"],
  "code_challenge_methods_supported": ["S256"],
  "scopes_supported": ["openid", "profile", "email", "offline_access", "admin"],
  "claims_supported": ["sub", "email", "email_verified", "preferred_username", "name", "picture", "auth_time"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"]
}
```

---

## JWKS

### `GET /api/v2/auth?action=jwks`

Returns the JSON Web Key Set used to verify token signatures.

```json
{
  "keys": [
    {
      "kty": "RSA",
      "kid": "...",
      "use": "sig",
      "alg": "RS256",
      "n": "...",
      "e": "AQAB"
    }
  ]
}
```

---

## Dynamic Client Registration

### `POST /api/v2/auth?action=oauth_register_app`

Register a new OAuth client dynamically (RFC 7591). No authentication required.

**Request**

```json
{
  "action": "oauth_register_app",
  "client_name": "My Cool App",
  "redirect_uris": ["https://myapp.com/callback"],
  "token_endpoint_auth_method": "none",
  "scope": "openid profile email",
  "client_uri": "https://myapp.com",
  "logo_uri": "https://myapp.com/logo.png",
  "contacts": ["dev@myapp.com"]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `redirect_uris` | `string[]` | ✅ | Array of allowed redirect URIs (min 1) |
| `client_name` | `string` | No | Human-readable name (default: `"OAuth Client"`) |
| `token_endpoint_auth_method` | `string` | No | `"none"` (public), `"client_secret_basic"`, or `"client_secret_post"` |
| `scope` | `string` | No | Space-separated scopes (default: `"openid profile email"`) |
| `client_uri` | `string` | No | Client homepage URL |
| `logo_uri` | `string` | No | Client logo URL |
| `contacts` | `string[]` | No | Developer contact emails |

**Response `201`**

```json
{
  "client_id": "client_a1b2c3d4e5f6...",
  "client_name": "My Cool App",
  "redirect_uris": ["https://myapp.com/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "scope": "openid profile email",
  "client_id_issued_at": 1726300000,
  "client_secret": "secret_...",
  "client_secret_expires_at": 0
}
```

> `client_secret` is only returned for confidential clients (`token_endpoint_auth_method` ≠ `"none"`).

**Rate limit:** 5 registrations per IP per hour.

---

## Dashboard App Registration

### `POST /api/v2/auth?action=oauth_register_app`

> 🔒 **Requires authentication**

Authenticated Materio users can also register apps from the dashboard:

```json
{
  "action": "oauth_register_app",
  "name": "My App",
  "redirectUri": "https://myapp.com/callback"
}
```

**Response `200`**

```json
{
  "success": true,
  "app": {
    "client_id": "client_...",
    "client_secret": "secret_...",
    "name": "My App",
    "redirect_uri": "https://myapp.com/callback",
    "user_id": "uuid"
  }
}
```

---

## List OAuth Apps

### `GET /api/v2/auth?action=oauth_list_apps`

> 🔒 **Requires authentication**

Returns all OAuth apps registered by the authenticated user.

**Response `200`**

```json
{
  "apps": [
    {
      "client_id": "client_...",
      "name": "My App",
      "redirect_uri": "https://...",
      "created_at": "2025-01-01T..."
    }
  ]
}
```

---

## Delete OAuth App

### `POST /api/v2/auth?action=oauth_delete_app`

> 🔒 **Requires authentication**

```json
{
  "action": "oauth_delete_app",
  "clientId": "client_..."
}
```

**Response `200`**

```json
{ "success": true }
```

---

## Get Client Info

### `GET /api/v2/auth?action=oauth_client_info&client_id=<client_id>`

Public endpoint to get basic info about a registered OAuth client.

**Response `200`**

```json
{
  "client_id": "client_...",
  "name": "My App",
  "redirect_uri": "https://myapp.com/callback"
}
```

---

## Authorization

### `POST /api/v2/auth?action=oauth_authorize`

> 🔒 **Requires authentication**

Issue an authorization code for a given client. Used by the consent screen.

**Request**

```json
{
  "action": "oauth_authorize",
  "client_id": "client_...",
  "redirect_uri": "https://myapp.com/callback",
  "response_type": "code",
  "scope": "openid profile email",
  "state": "random_state_value",
  "code_challenge": "E9Melhoa2OwvFrEMTJguCHa...",
  "code_challenge_method": "S256",
  "nonce": "random_nonce",
  "prompt": "consent"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `client_id` | `string` | ✅ | The registered client ID |
| `redirect_uri` | `string` | ✅ | Must match a registered redirect URI |
| `response_type` | `string` | No | Only `"code"` is supported (default) |
| `scope` | `string` | No | Space-separated scopes |
| `state` | `string` | Recommended | Opaque value for CSRF protection |
| `code_challenge` | `string` | Conditional | Required for public clients / PKCE |
| `code_challenge_method` | `string` | Conditional | Only `"S256"` supported |
| `nonce` | `string` | No | OIDC nonce for replay protection |
| `prompt` | `string` | No | `"none"` = fail if not logged in, `"consent"` = show consent |

**Response `200`**

```json
{
  "success": true,
  "code": "opaque_auth_code_...",
  "state": "random_state_value",
  "iss": "https://accounts.getmaterio.app"
}
```

> If `client_id` is not pre-registered, a **dynamic client** is auto-created with `token_endpoint_auth_method: "none"` and PKCE is required.

---

## Token Exchange

### `POST /api/v2/auth` (with `grant_type`)

Exchange an authorization code or refresh token for access/refresh tokens. Auto-detected when `grant_type` is present in the body.

### Authorization Code Grant

**Request** (JSON or `application/x-www-form-urlencoded`)

```json
{
  "grant_type": "authorization_code",
  "code": "opaque_auth_code_...",
  "redirect_uri": "https://myapp.com/callback",
  "client_id": "client_...",
  "client_secret": "secret_...",
  "code_verifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r..."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `grant_type` | `string` | ✅ | `"authorization_code"` |
| `code` | `string` | ✅ | Authorization code from the authorize step |
| `redirect_uri` | `string` | Recommended | Must match the original request |
| `client_id` | `string` | ✅ | Client ID |
| `client_secret` | `string` | Conditional | Required for confidential clients |
| `code_verifier` | `string` | Conditional | Required when PKCE was used |

> Client credentials can also be sent via `Authorization: Basic <base64(client_id:client_secret)>`.

### Refresh Token Grant

```json
{
  "grant_type": "refresh_token",
  "refresh_token": "opaque_refresh_...",
  "client_id": "client_...",
  "client_secret": "secret_...",
  "resource": "https://api.example.com"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `grant_type` | `string` | ✅ | `"refresh_token"` |
| `refresh_token` | `string` | ✅ | A valid, non-revoked refresh token |
| `client_id` | `string` | ✅ | Client ID |
| `resource` | `string` | No | Override the `aud` claim in the new access token |

**Response `200`**

```json
{
  "access_token": "eyJhbG...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "refresh_token": "opaque_refresh_...",
  "scope": "openid profile email",
  "id_token": "eyJhbG...",
  "user": {
    "id": "uuid",
    "username": "john_doe",
    "displayName": "John Doe",
    "email": "john@paruluniversity.ac.in",
    "hasAdminPrivileges": false,
    "isPlusUser": true,
    "isLiteUser": false,
    "profilePicture": "https://..."
  }
}
```

> `id_token` is included only when the `openid` scope was requested.
>
> Refresh tokens are rotated — the old refresh token is revoked and a new one is issued.

---

## UserInfo

### `GET /api/v2/auth?action=userinfo`

> 🔒 **Requires Bearer token**

Standard OIDC UserInfo endpoint.

**Response `200`**

```json
{
  "sub": "12345",
  "email": "john@paruluniversity.ac.in",
  "email_verified": true,
  "preferred_username": "john_doe",
  "name": "John Doe",
  "picture": "https://..."
}
```

---

## Token Revocation

### `POST /api/v2/auth?action=oauth_revoke`

Revoke an access or refresh token (RFC 7009).

**Request**

```json
{
  "action": "oauth_revoke",
  "token": "eyJhbG...",
  "token_type_hint": "access_token",
  "client_id": "client_..."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `token` | `string` | ✅ | Token to revoke |
| `token_type_hint` | `string` | No | `"access_token"` or `"refresh_token"` |
| `client_id` | `string` | No | Client that issued the token |

**Response `200`** — Empty body on success.

---

## Token Introspection

### `POST /api/v2/auth?action=oauth_introspect`

Introspect a token (RFC 7662). The calling client must be the client that issued the token.

**Request**

```json
{
  "action": "oauth_introspect",
  "token": "eyJhbG...",
  "client_id": "client_...",
  "client_secret": "secret_..."
}
```

**Response `200` (active token)**

```json
{
  "active": true,
  "sub": "12345",
  "username": "john_doe",
  "email": "john@paruluniversity.ac.in",
  "client_id": "client_...",
  "scope": "openid profile email",
  "token_type": "Bearer",
  "exp": 1726400000,
  "iat": 1726313600,
  "iss": "https://accounts.getmaterio.app",
  "aud": "client_...",
  "jti": "uuid"
}
```

**Response `200` (inactive token)**

```json
{ "active": false }
```

---

## Fetch URL Title

### `GET /api/v2/auth?action=fetch_url_title&url=<url>`

Utility endpoint that fetches the `<title>` and favicon of a given URL. Used by the consent screen to display client info.

**Response `200`**

```json
{
  "title": "My Cool App",
  "icon": "https://myapp.com/favicon.ico"
}
```

> Includes SSRF protection against private IPs.
