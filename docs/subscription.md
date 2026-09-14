# Subscription API

All endpoints require a valid JWT Bearer token in the `Authorization` header.

```
Authorization: Bearer <token>
```

---

## Redeem Gift Code

### `POST /api/v2/subscription/redeem`

Redeem an invite/gift code to activate a Pro subscription.

**Request**

```json
{
  "code": "MATERIO-PLUS"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `code` | `string` | ✅ | Gift/invite code to redeem |

**Response `200`**

```json
{
  "success": true,
  "plan": "Pro",
  "message": "Welcome to Materio Pro!"
}
```

**Errors**

| Status | Error |
|---|---|
| `400` | Missing code / code doesn't include subscription |
| `404` | Invalid gift code / user not found |
| `409` | User already has an active subscription / code already used by this user |
| `410` | Code expired or max uses reached |

**Business logic:**
- Each user can only redeem a specific code once (enforced via `invite_redemptions` table).
- Multi-use codes track `current_uses` vs `max_uses` with optimistic concurrency.
- Redemption is rolled back if the subscription update fails.

---

## Cancel Subscription

### `POST /api/v2/subscription/cancel`

Cancel the user's active subscription (Plus or Lite).

**Response `200`**

```json
{
  "success": true,
  "message": "Your subscription has been cancelled"
}
```

**Errors**

| Status | Error |
|---|---|
| `400` | No active subscription to cancel |
| `403` | Super users cannot cancel directly — must [transfer admin](#transfer-admin-privileges) first |
| `404` | User not found |

---

## Transfer Admin Privileges

### `POST /api/v2/subscription/transfer-admin`

> 🔒 **Requires admin privileges**

Transfer super admin privileges to another user. This also revokes the current user's subscription and admin access.

**Request**

```json
{
  "successorUsername": "jane_doe"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `successorUsername` | `string` | ✅ | Username of the user to promote |

**Response `200`**

```json
{
  "success": true,
  "message": "Admin privileges transferred to jane_doe. Your subscription has been cancelled."
}
```

**Side effects:**
- Successor receives `has_admin_privileges: true`
- Current user loses `has_admin_privileges`, `is_plus_user`, `is_lite_user`
- An email notification is sent to the successor
- If the update to the current user fails, the successor grant is rolled back

**Errors**

| Status | Error |
|---|---|
| `400` | Missing username / cannot transfer to yourself |
| `403` | Only super users can transfer |
| `404` | Successor user not found |
| `409` | Successor already has admin privileges |
