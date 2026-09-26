# Subscription & Billing API

All endpoints require a valid JWT Bearer token in the `Authorization` header.

```
Authorization: Bearer <token>
```

## Plan model (monthly, no Forever plans)

| UI plan | Price | DB flag | Expiry |
|---|---|---|---|
| Plus | ₹199/month | `is_lite_user = true` | `lite_expiry` = +30 days per payment |
| Pro | ₹349/month | `is_plus_user = true` | `lite_expiry` = +30 days per payment |
| Weekly Pass | ₹79/week (full Pro) | `is_plus_user = true` | `lite_expiry` = +7 days per payment |
| Pro (gift) | Invite code | `is_plus_user = true` | **none — lifetime** (`subscription_status = 'lifetime'`) |

Lifetime grants (invite codes, admin grants) also record a **₹0 receipt** in
`payments` (`provider = 'gift'`), so forever-plan holders get invoices and
PDF downloads like everyone else. Run `migrations/005_lifetime_zero_receipts.sql`
(it also relaxes the amount guard to `>= 0` and backfills existing holders).

Every Razorpay activation/renewal sets `lite_expiry` (also mirrored to
`subscription_current_period_end`). A monthly tier with past `lite_expiry` is
treated as free (lazy-expired by `GET /api/v2/billing/status`). Razorpay never
grants forever plans — lifetime access (`lite_expiry = null`,
`subscription_status = 'lifetime'`) comes ONLY from invite-code redemption
(Pro) or admin grants, and is never auto-expired. Razorpay columns:
`stripe_customer_id`, `stripe_subscription_id`, `subscription_plan`,
`subscription_status`, `last_payment_at`, `last_invoice_id`. Charge history
lives in the `payments` table (see `migrations/003_billing_subscriptions.sql`).

Without `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` the API runs in **test mode**:
checkout returns a mock payload routed to the custom `/upgrade/pay` Razorpay
test screen (card `4718 6091 0820 4366` — the subscription-eligible test card), and `confirm-test` activates the tier
instantly. Add real TEST keys (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
`PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_WEBHOOK_SECRET`, optional
`RAZORPAY_PLAN_PLUS` / `RAZORPAY_PLAN_PRO` monthly plan ids) to enable live
recurring Razorpay subscriptions + webhooks. Tables use provider-neutral
columns so a future provider switch only touches the adapter code.

---

## Razorpay Billing

### `POST /api/v2/billing/checkout`

Create a recurring (monthly, auto-renew) Razorpay subscription. Called
**directly from the landing pricing page** and from `/upgrade`.

```json
{ "plan": "plus" }
```

Response (test mode): `{ provider: "razorpay", sessionId, url: "<accounts>/upgrade/pay?...", testMode: true, plan, amountInr }`
Response (live): `{ provider: "razorpay", sessionId: "sub_...", subscriptionId: "sub_...", keyId: "rzp_test_...", testMode: false, plan, amountInr }`
— the frontend opens the styled Checkout.js modal (`subscription_id` + `keyId`: UPI-first ordering, Materio theme, locked backdrop) and polls `status` until the webhook activates the plan. Auth links expire after 24h.

| Status | Error |
|---|---|
| `400` | Invalid plan |
| `409` | Same tier already active / lifetime access active / super user |
| `502` | Razorpay subscription creation failed |

### `GET /api/v2/billing/status`

Effective plan (expiry-aware), subscription + billing details, invoice history.

```json
{
  "provider": "razorpay",
  "plan": "plus",
  "expiry": "2026-10-23T...",
  "lifetime": false,
  "subscription": { "plan": "plus", "status": "active", "periodEnd": "...", "subscriptionId": "sub_..." },
  "currentPlan": { "id": "plus", "label": "Materio Plus", "priceInr": 199, "interval": "month" },
  "invoices": [],
  "testMode": true,
  "keyId": null
}
```

### `POST /api/v2/billing/cancel`

Cancel at period end by default (keeps access until `lite_expiry`).

```json
{ "immediate": false }
```

### `POST /api/v2/billing/webhook`

Razorpay webhook (`x-razorpay-signature` verified when
`RAZORPAY_WEBHOOK_SECRET` is set — configure
`subscription.activated/charged/cancelled/completed/expired/halted` events).
`subscription.activated`/`charged` activate + extend 30 days (period end from
`current_end`), `cancelled` turns off renewal keeping access till period end,
`completed`/`expired`/`halted` end access.

### `POST /api/v2/billing/confirm-test`

TEST MODE ONLY (403 once live keys exist). Simulates the test payment for
the custom pay screen: `{ "plan": "plus", "sessionId": "...", "cardNumber": "4718..." }`.

### `GET /api/v2/billing/invoices`

Styled invoice list for the subscription page. Merges local payment records
(plan, period) with Razorpay invoices (status + `short_url` download link).
Rows without a Razorpay match (mock payments) carry `downloadUrl: null`.

```json
{
  "invoices": [
    {
      "id": "inv_...",
      "date": "2026-09-24T...",
      "plan": "plus",
      "amountPaise": 19900,
      "currency": "inr",
      "status": "paid",
      "periodEnd": "2026-10-24T...",
      "downloadUrl": "https://rzp.io/i/...",
      "receipt": null
    }
  ],
  "count": 1
}
```

### `GET /api/v2/billing/invoices/[id]/pdf`

Direct PDF download of an invoice, generated server-side in Materio branding
(no Razorpay page involved). Accepts a local payment row id or a Razorpay
`inv_*` id (ownership verified). Returns `application/pdf` as an attachment.

```text
GET /api/v2/billing/invoices/inv_.../pdf
Authorization: Bearer <token>
```

### Invoice brand assets

The PDF uses OpenRunde (Regular/Bold), Quadrant (accent line), and the
sticker logo — embedded as base64 in
`apps/accounts/src/lib/server/assets/invoice-assets.ts` (generated, ~200KB).
To regenerate (e.g. new logo): convert brand WOFF/WOFF2 fonts to subset TTF
with rupees kept — `fontTools` cu2qu CFF→glyf recipe + subset
`U+0020-007E,U+00A0-00FF,U+2010-201F,U+20B9`, force `flavor=None` on save
(jsPDF/pdf-lib/fontkit cannot read WOFF wrappers or CFF the same way, and
`bud.svg` can't be rasterized server-side so it stays out).

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
