# Integration Guide

This guide walks you through integrating a third-party application with the Materio platform using OAuth 2.0 / OpenID Connect.

---

## Overview

Materio supports the **Authorization Code flow** with optional **PKCE** (Proof Key for Code Exchange), making it suitable for both server-side and single-page applications.

```
┌─────────┐         ┌─────────────┐         ┌──────────────┐
│  Your    │         │   Materio   │         │   Materio    │
│  App     │────────▶│   Auth UI   │────────▶│   Token API  │
│          │◀────────│ (Consent)   │◀────────│              │
└─────────┘         └─────────────┘         └──────────────┘
```

**Flow:**
1. Your app redirects the user to Materio's authorization endpoint
2. The user logs in (if needed) and grants consent
3. Materio redirects back to your app with an authorization `code`
4. Your app exchanges the `code` for tokens

---

## Step 1 — Register Your Application

You have two options:

### Option A: Dynamic Client Registration (Recommended)

No Materio account needed. Register programmatically:

```bash
curl -X POST https://accounts.getmaterio.app/api/v2/auth?action=oauth_register_app \
  -H 'Content-Type: application/json' \
  -d '{
    "client_name": "My App",
    "redirect_uris": ["https://myapp.com/callback"],
    "token_endpoint_auth_method": "none",
    "scope": "openid profile email"
  }'
```

Save the returned `client_id` (and `client_secret` for confidential clients).

### Option B: Dashboard Registration

1. Log in at [accounts.getmaterio.app](https://accounts.getmaterio.app)
2. Navigate to **SSO / OAuth Apps**
3. Click **Register New App**
4. Enter your app name and redirect URI
5. Copy your `client_id` and `client_secret`

---

## Step 2 — Redirect to Authorization

Redirect the user's browser to the Materio authorization page:

```
https://accounts.getmaterio.app/account/sso
  ?client_id=YOUR_CLIENT_ID
  &redirect_uri=https://myapp.com/callback
  &response_type=code
  &scope=openid profile email
  &state=random_csrf_state
  &code_challenge=E9Melhoa2OwvFrEMTJguCHa...
  &code_challenge_method=S256
```

### PKCE (Required for Public Clients)

Generate a code verifier and challenge:

```javascript
// Generate random code_verifier
const codeVerifier = crypto.randomUUID() + crypto.randomUUID();

// Create S256 challenge
const encoder = new TextEncoder();
const data = encoder.encode(codeVerifier);
const digest = await crypto.subtle.digest('SHA-256', data);
const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');
```

> **Important:** Store `codeVerifier` in your session — you'll need it in Step 3.

---

## Step 3 — Handle the Callback

After the user grants consent, Materio redirects back to your `redirect_uri`:

```
https://myapp.com/callback?code=AUTH_CODE&state=random_csrf_state&iss=https://accounts.getmaterio.app
```

1. Verify the `state` parameter matches your original value
2. Exchange the `code` for tokens:

```bash
curl -X POST https://accounts.getmaterio.app/api/v2/auth \
  -H 'Content-Type: application/json' \
  -d '{
    "grant_type": "authorization_code",
    "code": "AUTH_CODE",
    "redirect_uri": "https://myapp.com/callback",
    "client_id": "YOUR_CLIENT_ID",
    "code_verifier": "YOUR_CODE_VERIFIER"
  }'
```

**Response:**

```json
{
  "access_token": "eyJhbG...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "refresh_token": "opaque_...",
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

---

## Step 4 — Use the Access Token

Include the access token in API requests:

```bash
curl https://accounts.getmaterio.app/api/v2/auth?action=userinfo \
  -H 'Authorization: Bearer ACCESS_TOKEN'
```

**UserInfo Response:**

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

## Step 5 — Refresh Tokens

Access tokens expire after 24 hours. Use the refresh token to get a new one:

```bash
curl -X POST https://accounts.getmaterio.app/api/v2/auth \
  -H 'Content-Type: application/json' \
  -d '{
    "grant_type": "refresh_token",
    "refresh_token": "REFRESH_TOKEN",
    "client_id": "YOUR_CLIENT_ID"
  }'
```

> Refresh tokens are rotated — each exchange returns a new refresh token and the old one is revoked. Refresh tokens expire after 30 days.

---

## Step 6 — Logout (Optional)

To log the user out of Materio:

```
GET https://accounts.getmaterio.app/api/v2/auth?action=logout
  &id_token_hint=ID_TOKEN
  &post_logout_redirect_uri=https://myapp.com
  &state=random
```

---

## Complete Example: Node.js Express

```javascript
import express from 'express';
import crypto from 'crypto';

const app = express();
const CLIENT_ID = 'client_abc123';
const REDIRECT_URI = 'http://localhost:3000/callback';
const MATERIO_BASE = 'https://accounts.getmaterio.app';

// Store in-memory (use sessions in production)
const sessions = new Map();

app.get('/login', (req, res) => {
  const state = crypto.randomUUID();
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  sessions.set(state, { codeVerifier });

  const authUrl = new URL(`${MATERIO_BASE}/account/sso`);
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid profile email');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  res.redirect(authUrl.toString());
});

app.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  const session = sessions.get(state);

  if (!session) return res.status(400).send('Invalid state');
  sessions.delete(state);

  const tokenRes = await fetch(`${MATERIO_BASE}/api/v2/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: session.codeVerifier,
    }),
  });

  const tokens = await tokenRes.json();
  res.json({ user: tokens.user, access_token: tokens.access_token });
});

app.listen(3000, () => console.log('http://localhost:3000'));
```

---

## Complete Example: React SPA

```jsx
// LoginButton.jsx
function LoginButton() {
  const handleLogin = async () => {
    const codeVerifier = crypto.randomUUID() + crypto.randomUUID();
    sessionStorage.setItem('pkce_verifier', codeVerifier);

    const encoder = new TextEncoder();
    const digest = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(codeVerifier)
    );
    const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const state = crypto.randomUUID();
    sessionStorage.setItem('oauth_state', state);

    const params = new URLSearchParams({
      client_id: 'YOUR_CLIENT_ID',
      redirect_uri: window.location.origin + '/callback',
      response_type: 'code',
      scope: 'openid profile email',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    window.location.href =
      `https://accounts.getmaterio.app/account/sso?${params}`;
  };

  return <button onClick={handleLogin}>Login with Materio</button>;
}
```

```jsx
// Callback.jsx
import { useEffect } from 'react';

function Callback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (state !== sessionStorage.getItem('oauth_state')) {
      alert('Invalid state');
      return;
    }

    fetch('https://accounts.getmaterio.app/api/v2/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: window.location.origin + '/callback',
        client_id: 'YOUR_CLIENT_ID',
        code_verifier: sessionStorage.getItem('pkce_verifier'),
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        window.location.href = '/dashboard';
      });
  }, []);

  return <p>Authenticating...</p>;
}
```

---

## Cross-Domain Handoff Flow

For Materio internal apps (accounts, auth, admin), a **handoff code** mechanism enables seamless cross-domain authentication:

1. **Auth app** authenticates the user and calls `POST /api/v2/login` with `action: "create"` to generate a handoff code
2. Auth app redirects to `accounts.getmaterio.app/auth/callback?code=<handoffCode>`
3. The callback page calls `POST /api/v2/login` with `action: "exchange"` and `code` to exchange for a full token
4. User is logged into the accounts app

> Handoff codes expire in **60 seconds** and are single-use.

---

## Security Best Practices

| Practice | Details |
|---|---|
| **Always use PKCE** | Required for public clients; recommended for all |
| **Validate `state`** | Prevents CSRF attacks |
| **Validate `iss`** | Check the `iss` query param in callbacks matches expected issuer |
| **Store tokens securely** | Use `httpOnly` cookies or secure session storage, never plain `localStorage` for production apps |
| **Handle token expiry** | Implement automatic refresh token rotation |
| **Use HTTPS** | All production endpoints require HTTPS |

---

## Supported Scopes

| Scope | Description |
|---|---|
| `openid` | Enables OIDC — returns `id_token` |
| `profile` | Access to `name`, `preferred_username`, `picture` |
| `email` | Access to `email`, `email_verified` |
| `offline_access` | Issues a refresh token |
| `admin` | Access to admin-level user data |

---

## Endpoints Summary

| Purpose | Method | URL |
|---|---|---|
| Discovery | `GET` | `/api/v2/auth?action=oauth_metadata` |
| OIDC Discovery | `GET` | `/api/v2/auth?action=oidc_metadata` |
| JWKS | `GET` | `/api/v2/auth?action=jwks` |
| Register Client | `POST` | `/api/v2/auth?action=oauth_register_app` |
| Authorize | Browser redirect | `/account/sso?client_id=...&redirect_uri=...` |
| Token Exchange | `POST` | `/api/v2/auth` (with `grant_type`) |
| UserInfo | `GET` | `/api/v2/auth?action=userinfo` |
| Revoke Token | `POST` | `/api/v2/auth?action=oauth_revoke` |
| Introspect Token | `POST` | `/api/v2/auth?action=oauth_introspect` |
| Logout | `GET`/`POST` | `/api/v2/auth?action=logout` |
