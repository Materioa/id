# Error Reference

All Materio API endpoints return errors as JSON objects with a consistent structure.

---

## Standard Error Shape

```json
{
  "error": "Human-readable error message",
  "details": "Additional context (optional)"
}
```

For OAuth endpoints, errors follow RFC 6749:

```json
{
  "error": "invalid_request",
  "error_description": "client_id is required"
}
```

---

## HTTP Status Codes

| Status | Meaning | When Used |
|---|---|---|
| `200` | Success | Successful read, update, or action |
| `201` | Created | New resource created (signup, client registration) |
| `400` | Bad Request | Missing or invalid fields, validation errors |
| `401` | Unauthorized | Missing, invalid, or expired authentication token |
| `403` | Forbidden | Insufficient privileges (e.g., non-admin accessing admin routes) |
| `404` | Not Found | User, app, or resource not found |
| `405` | Method Not Allowed | Wrong HTTP method for the endpoint |
| `409` | Conflict | Duplicate resource (email exists, username taken, already subscribed) |
| `410` | Gone | Invite code expired or max uses reached |
| `429` | Too Many Requests | Rate limit exceeded (data export cooldown, client registration) |
| `500` | Internal Server Error | Unexpected server-side failure |

---

## Common Error Messages

### Authentication

| Error | Status | Cause |
|---|---|---|
| `"Authentication token required"` | 401 | No `Authorization` header |
| `"Invalid or expired token"` | 401 | JWT is malformed, expired, or revoked |
| `"Unauthorized"` | 401 | Token is valid but user lacks required privileges |
| `"Identity not found"` | 401 | Username/email not found during login |
| `"Invalid credentials"` | 401 | Wrong password |
| `"Invalid or expired verification code"` | 400/401 | OTP or TOTP code is wrong or expired |
| `"2FA required"` | 200 | Not an error — indicates 2FA flow needed |

### Signup

| Error | Status | Cause |
|---|---|---|
| `"Missing required fields including verification code"` | 400 | One or more required signup fields missing |
| `"Only Parul University emails are allowed"` | 400 | Email is not `@paruluniversity.ac.in` or `@getmaterio.app` |
| `"Email already exists"` | 409 | Duplicate email |
| `"Username already taken"` | 409 | Duplicate username |
| `"Invalid or expired gift code"` | 400 | Invite code is invalid at signup |

### Profile

| Error | Status | Cause |
|---|---|---|
| `"Username already taken"` | 400 | New username conflicts with another user |
| `"Current password is incorrect"` | 401 | Wrong password when changing password or regenerating recovery key |
| `"Current password required"` | 400 | `currentPassword` missing when `generateNewRecoveryKey` is true |
| `"Invalid profile picture format"` | 400 | Profile picture is not a valid data URI |
| `"Password confirmation required"` | 400 | Missing password on account deletion |

### Subscription

| Error | Status | Cause |
|---|---|---|
| `"Gift code is required"` | 400 | Empty code field |
| `"Invalid gift code"` | 404 | Code not found in database |
| `"This code has reached its maximum uses"` | 410 | Code fully redeemed |
| `"This gift code has expired"` | 410 | Past expiration date |
| `"You already have an active subscription"` | 409 | User is already Plus/Lite/Admin |
| `"You have already used this gift code"` | 409 | Unique constraint on `invite_redemptions` |
| `"No active subscription to cancel"` | 400 | User has no Plus/Lite subscription |
| `"Super users cannot cancel directly"` | 403 | Admin must transfer privileges first |

### OAuth

| Error | Status | Cause |
|---|---|---|
| `"invalid_request"` | 400 | Missing required parameter |
| `"invalid_client"` | 401 | Unknown `client_id` or wrong `client_secret` |
| `"invalid_grant"` | 400 | Expired/invalid auth code or refresh token |
| `"unsupported_response_type"` | 400 | Only `code` is supported |
| `"unsupported_grant_type"` | 400 | Only `authorization_code` and `refresh_token` supported |
| `"invalid_token"` | 401 | Token is revoked or invalid (UserInfo endpoint) |
| `"login_required"` | 400/302 | `prompt=none` but user is not logged in |
| `"server_error"` | 500 | Unexpected internal error |
| `"slow_down"` | 429 | Too many client registrations (5/hour/IP) |
| `"forbidden"` | 403 | Token introspection from wrong client |

### Admin

| Error | Status | Cause |
|---|---|---|
| `"Unauthorized"` | 401 | Not authenticated or not an admin |
| `"ID is required"` | 400 | Missing resource ID for update/delete |
| `"Code is required"` | 400 | Missing invite code for deletion |
| `"userId is required"` | 400 | Missing user ID for privilege toggle |
| `"Invalid action"` | 400 | Unknown action on `users/[action]` route |
| `"A reason for the ban is required"` | 400 | Empty ban reason |
| `"At least one identifier is required"` | 400 | Anonymous ban without anon_id/fingerprint/ip |

---

## Rate Limits

| Endpoint | Limit | Window |
|---|---|---|
| Data Export (`POST /api/v2/data-export`) | 1 request | 24 hours |
| OAuth Client Registration | 5 registrations | 1 hour per IP |

---

## Error Handling Best Practices

1. **Always check `res.ok`** before parsing the response body
2. **Handle 401** by redirecting to login or refreshing the token
3. **Handle 429** by respecting the `cooldownUntil` timestamp
4. **Display `error`** field to the user for user-facing errors
5. **Log `details`** for debugging server-side issues
