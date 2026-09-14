# Materio apps monorepo

This repository contains three independently deployable SvelteKit applications that share the Materio UI, configuration, and utility packages.

## Applications

| App | Local port | Production domain | Responsibility |
| --- | ---: | --- | --- |
| `@materio/accounts` | 5173 | `accounts.getmaterio.app` | Account dashboard and settings |
| `@materio/auth` | 5174 | `auth.getmaterio.app` | Login, signup, password recovery, and OAuth authorization |
| `@materio/admin` | 5175 | `admin.getmaterio.app` | Administrative dashboard and admin APIs |

The auth app supports the existing callback handoff flow: clients redirect to `/authorize`, unauthenticated users are sent to `/login?callback=...`, and successful authorization returns a code to the validated redirect URI.

## Workspace commands

```sh
bun install
bun run all          # Start all 3 app servers in parallel
bun run dev:accounts # Or start individually
bun run dev:auth
bun run dev:admin
bun run check
bun run build
```

Run deployment commands from the relevant app directory with Wrangler. Configure secrets with `wrangler secret put`; secrets are intentionally not stored in `wrangler.jsonc`.

## API Documentation

Full API reference and integration guide are available in the [`docs/`](./docs/README.md) directory:

| Guide | Description |
| --- | --- |
| [Authentication](./docs/authentication.md) | Login, signup, OTP, 2FA, and session management |
| [OAuth & OIDC](./docs/oauth.md) | Full OAuth 2.0 / OpenID Connect provider reference |
| [Profile & Account](./docs/profile.md) | Profile CRUD, password changes, data export, and account deletion |
| [Subscription](./docs/subscription.md) | Gift-code redemption, cancellation, and admin transfer |
| [Admin APIs](./docs/admin.md) | User management, bans, invites, notifications, releases, exams, CDN |
| [Integration Guide](./docs/integration-guide.md) | Step-by-step guide for third-party app integration via OAuth |
| [Internal Integration](./docs/internal-integration.md) | Handoff-callback SSO for Materio's own apps |
| [Deployment Guide](./docs/deployment.md) | Cloudflare Workers deployment with custom domains |
| [Error Reference](./docs/errors.md) | Standard error shapes, status codes, and rate limits |

## Shared packages

- `packages/ui` — shared styles and reusable Svelte components
- `packages/config` — shared runtime configuration modules
- `packages/utils` — shared server-side utility modules
