# Authentication API

All authentication endpoints are served from the **Accounts** (`accounts.getmaterio.app`) and **Auth** (`auth.getmaterio.app`) apps. Both apps expose identical login/signup/OTP surfaces so that either domain can authenticate users.

---

## Login

### `POST /api/v2/login`

Authenticate a user and receive a JWT token. Supports three distinct flows via the same endpoint.

#### Flow 1 — Password / OTP Login

**Request**

```json
{
  "username": "john_doe",
  "password": "s3cret!",
  "method": "password"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `username` | `string` | ✅ | Username **or** email address |
| `password` | `string` | ✅ (password) | User's password |
| `method` | `string` | No | `"password"` (default) or `"otp"` |
| `otp` | `string` | ✅ (otp) | 6-digit OTP code when `method` is `"otp"` |

**Response `200`**

```json
{
  "message": "Login successful",
  "handoffCode": "abc123...",
  "token": "eyJhbG...",
  "user": {
    "id": "uuid",
    "username": "john_doe",
    "displayName": "John Doe",
    "email": "john@paruluniversity.ac.in",
    "hasAdminPrivileges": false,
    "isPlusUser": true,
    "profilePicture": "https://..."
  }
}
```

> **2FA checkpoint** — If the user has two-factor authentication enabled, the response will instead return a temporary token:
>
> ```json
> {
>   "message": "2FA required",
>   "requires_2fa": true,
>   "tempToken": "eyJhbG..."
> }
> ```
> Use the `tempToken` to call [Verify 2FA for Login](#verify-2fa-for-login).

**Errors**

| Status | Error |
|---|---|
| `400` | Missing username or password |
| `401` | Invalid credentials / identity not found |

---

#### Flow 2 — Create Handoff Code

Create a short-lived handoff code from an existing token, allowing cross-domain login propagation.

**Request**

```
POST /api/v2/login
Authorization: Bearer <token>
```

```json
{
  "action": "create"
}
```

**Response `200`**

```json
{
  "message": "Handoff code created",
  "handoffCode": "abc123...",
  "expiresIn": 60
}
```

---

#### Flow 3 — Exchange Handoff Code

Exchange a handoff code for a full session token.

**Request**

```json
{
  "action": "exchange",
  "code": "abc123..."
}
```

**Response `200`**

```json
{
  "message": "Handoff successful",
  "token": "eyJhbG...",
  "user": { ... }
}
```

---

## Signup

### `POST /api/v2/signup`

Create a new user account. Requires a verified OTP obtained via the [Send OTP](#send-otp-general) endpoint.

**Request**

```json
{
  "username": "john_doe",
  "displayName": "John Doe",
  "email": "john@paruluniversity.ac.in",
  "password": "s3cret!",
  "otp": "482910",
  "avatarVariant": "shape",
  "inviteCode": "MATERIO-PLUS",
  "branch": "Computer Science and Engineering",
  "currentYear": "3",
  "passoutYear": "2027",
  "specialization": "AI/ML",
  "profilePicture": "data:image/png;base64,..."
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `username` | `string` | ✅ | Unique username |
| `displayName` | `string` | ✅ | Display name |
| `email` | `string` | ✅ | Must be `@paruluniversity.ac.in` or `@getmaterio.app` |
| `password` | `string` | ✅ | Password |
| `otp` | `string` | ✅ | 6-digit OTP obtained via Send OTP with `type: "signup"` |
| `avatarVariant` | `string` | No | Default `"shape"` |
| `inviteCode` | `string` | No | Gift code for Plus subscription |
| `branch` | `string` | No | Default `"Computer Science and Engineering"` |
| `currentYear` | `string` | No | Current year of study |
| `passoutYear` | `string` | No | Graduation year |
| `specialization` | `string` | No | Area of specialization |
| `profilePicture` | `string` | No | Base64 data URI of profile image |

**Response `201`**

```json
{
  "message": "User created successfully",
  "token": "eyJhbG...",
  "user": {
    "id": "uuid",
    "username": "john_doe",
    "displayName": "John Doe",
    "email": "john@paruluniversity.ac.in",
    "hasAdminPrivileges": false,
    "isPlusUser": false,
    "profilePicture": "https://...",
    "recoveryKey": "XXXX-XXXX-XXXX-XXXX"
  }
}
```

**Errors**

| Status | Error |
|---|---|
| `400` | Missing fields / invalid OTP / restricted email / invalid invite code |
| `409` | Email or username already exists |

---

## Send OTP (Login)

### `POST /api/v2/login/otp/send`

Send a 6-digit one-time password to a user's email for passwordless login.

**Request**

```json
{
  "email": "john@paruluniversity.ac.in"
}
```

**Response `200`**

```json
{
  "message": "OTP sent successfully"
}
```

**Errors**

| Status | Error |
|---|---|
| `400` | Missing email |
| `404` | User not found |

---

## Send OTP (General)

### `POST /api/v2/auth` with `action: "otp"`

Send a 6-digit OTP for signup or account recovery.

**Request**

```json
{
  "action": "otp",
  "email": "john@paruluniversity.ac.in",
  "type": "signup"
}
```

| Field | Type | Required | Values |
|---|---|---|---|
| `email` | `string` | ✅ | User email |
| `type` | `string` | ✅ | `"signup"` or `"recovery"` |

**Response `200`**

```json
{
  "success": true,
  "message": "A verification code has been sent to john@paruluniversity.ac.in. It expires in 10 minutes."
}
```

> **Note:** Signup OTP emails are restricted to `@paruluniversity.ac.in` and `@getmaterio.app` domains.

---

## Verify 2FA for Login

### `POST /api/v2/login/verify-2fa`

Complete login after 2FA is required. Send the temporary token from the login response.

**Request**

```
Authorization: Bearer <tempToken>
```

```json
{
  "code": "482910"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `code` | `string` | ✅ | 6-digit TOTP code from authenticator app |

**Response `200`**

```json
{
  "message": "Login successful",
  "handoffCode": "abc123...",
  "token": "eyJhbG...",
  "user": { ... }
}
```

**Errors**

| Status | Error |
|---|---|
| `400` | Missing code / invalid code / 2FA not configured |
| `401` | Invalid or expired temporary token |

---

## Forgot Password

### `POST /api/v2/auth` with `action: "forgot-password"`

Reset a user's password using an OTP or recovery key.

**Request**

```json
{
  "action": "forgot-password",
  "email": "john@paruluniversity.ac.in",
  "otp": "482910",
  "newPassword": "n3wP@ssw0rd"
}
```

Or with recovery key:

```json
{
  "action": "forgot-password",
  "email": "john@paruluniversity.ac.in",
  "recoveryKey": "XXXX-XXXX-XXXX-XXXX",
  "newPassword": "n3wP@ssw0rd"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | `string` | ✅ | User email |
| `otp` | `string` | One of | 6-digit recovery OTP |
| `recoveryKey` | `string` | One of | Recovery key (alias: `recoveryCode`) |
| `newPassword` | `string` | No | New password. Omit to just verify the code. |

**Response `200` (password reset)**

```json
{
  "message": "Password updated successfully",
  "token": "eyJhbG..."
}
```

**Response `200` (verification only)**

```json
{
  "verified": true,
  "message": "Verification successful"
}
```

---

## Admin Recovery

### `POST /api/v2/auth` with `action: "admin-recovery"`

> 🔒 **Requires admin privileges**

Retrieve a user's full account data and recovery key. Both email and username must match.

**Request**

```
Authorization: Bearer <admin-token>
```

```json
{
  "action": "admin-recovery",
  "email": "john@paruluniversity.ac.in",
  "username": "john_doe"
}
```

**Response `200`**

```json
{
  "message": "Account recovery data retrieved successfully",
  "recoveryService": "Premium Admin Account Recovery",
  "adminId": "admin-uuid",
  "targetUser": {
    "id": "user-uuid",
    "username": "john_doe",
    "displayName": "John Doe",
    "email": "john@paruluniversity.ac.in",
    "profilePicture": "https://...",
    "recoveryKey": "XXXX-XXXX-XXXX-XXXX",
    "hasAdminPrivileges": false,
    "isPlusUser": true,
    "createdAt": "2025-01-15T...",
    "updatedAt": "2025-06-10T..."
  },
  "securityNote": "This recovery includes the user's recovery key for password reset purposes",
  "timestamp": "2025-09-14T..."
}
```

---

## Logout

### `POST /api/v2/auth` with `action: "logout"`

Also accepts `GET`. Clears local storage and redirects.

**Parameters** (query string or JSON body)

| Field | Type | Description |
|---|---|---|
| `post_logout_redirect_uri` | `string` | Where to redirect after logout (validated against client registration) |
| `id_token_hint` | `string` | OIDC id_token to identify the client for redirect URI validation |
| `state` | `string` | Opaque state value passed through to redirect |

**Response** — Returns an HTML page that clears `localStorage` then redirects.
