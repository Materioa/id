# Materio API Documentation

> Complete API reference and integration guide for the Materio platform.

## Table of Contents

| Section | Description |
|---------|-------------|
| [Authentication](./authentication.md) | Login, signup, OTP, 2FA, and session management |
| [OAuth & OIDC](./oauth.md) | Full OAuth 2.0 / OpenID Connect provider reference |
| [Profile & Account](./profile.md) | Profile CRUD, password changes, data export, and account deletion |
| [Subscription](./subscription.md) | Gift-code redemption, cancellation, and admin transfer |
| [Admin APIs](./admin.md) | User management, bans, invites, notifications, releases, exams, CDN, promotions |
| [Integration Guide](./integration-guide.md) | Step-by-step guide for third-party app integration via OAuth |
| [Internal Integration](./internal-integration.md) | Handoff-callback SSO for Materio's own apps |
| [Deployment Guide](./deployment.md) | Cloudflare Workers deployment with custom domains |
| [Error Reference](./errors.md) | Standard error shapes and status codes |

---

## Base URLs

| Application | Local | Production |
|---|---|---|
| **Accounts** | `http://localhost:5173` | `https://accounts.getmaterio.app` |
| **Auth** | `http://localhost:5174` | `https://auth.getmaterio.app` |
| **Admin** | `http://localhost:5175` | `https://admin.getmaterio.app` |

All API endpoints live under **`/api/v2/`** on their respective app domain.

## Authentication Model

Materio uses **JWT Bearer tokens** for API authentication.  
Include the token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Tokens are issued by the login, signup, and OAuth token endpoints.

## Quick Links

- [How to authenticate a user →](./authentication.md#login)
- [How to integrate via OAuth →](./integration-guide.md)
- [How to use the Admin API →](./admin.md)
