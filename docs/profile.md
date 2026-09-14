# Profile & Account API

All endpoints require a valid JWT Bearer token in the `Authorization` header.

```
Authorization: Bearer <token>
```

---

## Get Profile

### `GET /api/v2/profile`

Fetch the authenticated user's full profile, including ban status.

**Response `200`**

```json
{
  "user": {
    "id": "uuid",
    "username": "john_doe",
    "displayName": "John Doe",
    "email": "john@paruluniversity.ac.in",
    "profilePicture": "https://...",
    "recoveryKey": "XXXX-XXXX-XXXX-XXXX",
    "hasAdminPrivileges": false,
    "isPlusUser": true,
    "isLiteUser": false,
    "plusExpiry": null,
    "createdAt": "2025-01-15T...",
    "updatedAt": "2025-06-10T...",
    "branch": "Computer Science and Engineering",
    "specialization": "AI/ML",
    "twoFactorEnabled": true,
    "twoFactorEnabledAt": "2025-03-01T...",
    "isBanned": false,
    "banReason": ""
  },
  "suspended": false,
  "banReason": ""
}
```

> Ban status is resolved from MongoDB `abuse_moderation_rules` matching on `user_id`, `username`, or `email`.

**Errors**

| Status | Error |
|---|---|
| `401` | Missing or invalid token |
| `404` | User not found |

---

## Update Profile

### `PUT /api/v2/profile`

Update one or more profile fields. All fields are optional — only provided fields are updated.

**Request**

```json
{
  "username": "new_username",
  "displayName": "New Name",
  "branch": "Information Technology",
  "specialization": "Cybersecurity",
  "currentPassword": "old_password",
  "newPassword": "new_password",
  "generateNewRecoveryKey": true,
  "profilePicture": "data:image/png;base64,...",
  "disable2FA": true
}
```

| Field | Type | Description |
|---|---|---|
| `username` | `string` | New username (checked for uniqueness) |
| `displayName` | `string` | New display name |
| `branch` | `string` | Academic branch |
| `specialization` | `string` | Specialization |
| `currentPassword` | `string` | Required when changing password or regenerating recovery key |
| `newPassword` | `string` | New password (requires `currentPassword`) |
| `generateNewRecoveryKey` | `boolean` | Generate a fresh recovery key (requires `currentPassword`) |
| `profilePicture` | `string` | Base64 data URI (SVG, PNG, JPEG, WebP supported) |
| `disable2FA` | `boolean` | Set to `true` to disable two-factor authentication |

**Response `200`**

```json
{
  "message": "Profile updated successfully",
  "user": {
    "id": "uuid",
    "username": "new_username",
    "displayName": "New Name",
    "email": "john@paruluniversity.ac.in",
    "profilePicture": "https://...",
    "recoveryKey": "XXXX-XXXX-XXXX-XXXX",
    "hasAdminPrivileges": false,
    "isPlusUser": true,
    "isLiteUser": false,
    "plusExpiry": null,
    "createdAt": "2025-01-15T...",
    "updatedAt": "2025-09-14T...",
    "branch": "Information Technology",
    "specialization": "Cybersecurity"
  },
  "recoveryKey": "NEW-XXXX-XXXX-XXXX"
}
```

> `recoveryKey` at root level is only returned when `generateNewRecoveryKey` was `true`.

**Errors**

| Status | Error |
|---|---|
| `400` | Username taken / invalid profile picture / missing current password |
| `401` | Invalid token or incorrect current password |
| `404` | User not found |

---

## Delete Account

### `DELETE /api/v2/profile`

Permanently delete the authenticated user's account, including all stored profile pictures.

**Request**

```json
{
  "password": "current_password"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `password` | `string` | ✅ | Password confirmation for security |

**Response `200`**

```json
{
  "message": "Account deleted successfully"
}
```

**Errors**

| Status | Error |
|---|---|
| `400` | Missing password |
| `401` | Invalid password or token |
| `404` | User not found |

---

## Activity Heatmap

### `GET /api/v2/heatmap`

Fetch the user's daily activity heatmap data (reading hours per day).

**Response `200`**

```json
{
  "data": [
    { "date": "2025-01-15T00:00:00.000Z", "value": 2.5 },
    { "date": "2025-01-16T00:00:00.000Z", "value": 0.75 }
  ]
}
```

Each entry's `value` is the total hours (reading + engagement) for that day.

---

## Data Export

### `POST /api/v2/data-export`

Initiate a GDPR-style data export. The export is processed asynchronously — an email with a download link is sent when complete.

**Response `200`**

```json
{
  "success": true,
  "message": "Data export started. You will receive an email with a download link when it's ready."
}
```

**Rate limit:** One export per 24 hours.

```json
// 429 response
{
  "error": "You can request another export in 18 hours",
  "cooldownUntil": "2025-09-15T10:00:00.000Z"
}
```

**Export contents (ZIP file):**
- `account_profile.json` — Full profile data
- `activity_stats.json` — Daily reading stats
- `login_sessions.json` — Session history
- `app_data.json` — All MongoDB data linked to the user
- `thinklet/conversations.json` — Chat/conversation data
- `export_summary.json` — Export metadata

### `GET /api/v2/data-export`

Check the latest export request status.

**Response `200`**

```json
{
  "lastExport": {
    "status": "completed",
    "createdAt": "2025-09-13T...",
    "canRequestNew": true,
    "cooldownUntil": null
  }
}
```

---

## Two-Factor Authentication Setup

### Generate 2FA Secret

#### `POST /api/v2/security/2fa/generate`

Generate a TOTP secret and `otpauth://` URL for authenticator app setup.

**Response `200`**

```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "otpauthUrl": "otpauth://totp/Materio:john@paruluniversity.ac.in?secret=JBSWY3DPEHPK3PXP&issuer=Materio&algorithm=SHA1&digits=6&period=30"
}
```

> The secret is saved to the user's record but 2FA is **not yet enabled**.

### Verify & Enable 2FA

#### `POST /api/v2/security/2fa/verify`

Verify a TOTP code to confirm the user has successfully configured their authenticator and enable 2FA.

**Request**

```json
{
  "code": "482910"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "2FA has been successfully enabled"
}
```

**Errors**

| Status | Error |
|---|---|
| `400` | Missing code / invalid code / 2FA not initialized |

---

## Session Management

### List Sessions

#### `GET /api/v2/security/sessions`

Get all active sessions for the authenticated user.

**Response `200`**

```json
{
  "sessions": [
    {
      "id": "uuid",
      "user_agent": "Mozilla/5.0...",
      "ip_address": "203.0.113.42",
      "created_at": "2025-09-01T...",
      "last_active_at": "2025-09-14T..."
    }
  ],
  "currentSessionId": "uuid"
}
```

### Revoke Session

#### `DELETE /api/v2/security/sessions?id=<session_id>`

Terminate a specific session.

**Response `200`**

```json
{ "success": true }
```
