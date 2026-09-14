# Deployment Guide — Cloudflare Workers

> How to build and deploy all 3 Materio apps to Cloudflare Workers with custom domains.

---

## Domain Mapping

| App | Worker Name | Custom Domain | Local Dev |
|---|---|---|---|
| **Accounts** | `materio-accounts` | `accounts.getmaterio.app` | `http://localhost:5173` |
| **Auth / SSO** | `materio-auth` | `auth.getmaterio.app` | `http://localhost:5174` |
| **Admin** | `materio-admin` | `admin.getmaterio.app` | `http://localhost:5175` |

All three apps share the Cloudflare zone `getmaterio.app` and use the `@sveltejs/adapter-cloudflare` SvelteKit adapter.

---

## Prerequisites

1. **Cloudflare account** with the `getmaterio.app` domain managed in Cloudflare DNS
2. **Wrangler CLI** installed (`npm install -g wrangler` or available via `npx`)
3. **Wrangler authenticated** — run `wrangler login` once
4. **Bun** installed (used as the package manager)

---

## Project Structure

```
account-app/                    ← monorepo root
├── apps/
│   ├── accounts/               ← accounts.getmaterio.app
│   │   ├── wrangler.jsonc      ← worker config for this app
│   │   └── svelte.config.js    ← uses adapter-cloudflare
│   ├── auth/                   ← auth.getmaterio.app
│   │   ├── wrangler.jsonc
│   │   └── svelte.config.js
│   └── admin/                  ← admin.getmaterio.app
│       ├── wrangler.jsonc
│       └── svelte.config.js
├── packages/                   ← shared code
│   ├── config/                 ← @materio/config (includes URL resolver)
│   ├── ui/                     ← @materio/ui
│   └── utils/                  ← @materio/utils
├── wrangler.jsonc              ← root wrangler (legacy, secrets only)
└── package.json                ← monorepo scripts
```

---

## Wrangler Configuration

Each app has its own `wrangler.jsonc`. Here's the pattern:

### `apps/accounts/wrangler.jsonc`

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "materio-accounts",
  "compatibility_date": "2026-08-22",
  "compatibility_flags": ["nodejs_als", "nodejs_compat"],
  "main": ".svelte-kit/cloudflare/_worker.js",
  "assets": { "binding": "ASSETS", "directory": ".svelte-kit/cloudflare" },
  "workers_dev": true,
  "preview_urls": true,
  "routes": [
    {
      "pattern": "accounts.getmaterio.app",
      "zone_name": "getmaterio.app",
      "custom_domain": true,
      "enabled": true,
      "previews_enabled": false
    }
  ],
  "vars": {},
  "observability": {
    "redact_query_string": false,
    "logs": { "enabled": true },
    "traces": { "enabled": true }
  }
}
```

### `apps/auth/wrangler.jsonc`

Same structure, but:
```jsonc
"name": "materio-auth",
"routes": [{ "pattern": "auth.getmaterio.app", ... }]
```

> **To add `sso.getmaterio.app` as an alias**, add a second route entry:
> ```jsonc
> "routes": [
>   { "pattern": "auth.getmaterio.app", "zone_name": "getmaterio.app", "custom_domain": true, "enabled": true },
>   { "pattern": "sso.getmaterio.app", "zone_name": "getmaterio.app", "custom_domain": true, "enabled": true }
> ]
> ```

### `apps/admin/wrangler.jsonc`

```jsonc
"name": "materio-admin",
"routes": [{ "pattern": "admin.getmaterio.app", ... }]
```

---

## Secrets Management

Environment secrets are set via `wrangler secret put` and are **not** stored in `wrangler.jsonc`. Each app needs the same set of secrets:

```bash
# Run from each app directory (e.g., apps/accounts/)
wrangler secret put JWT_SECRET
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put PUBLIC_SUPABASE_ANON_KEY
wrangler secret put MONGODB_URI
wrangler secret put SMTP_EMAIL
wrangler secret put SMTP_PASSWORD
wrangler secret put GITHUB_TOKEN
wrangler secret put ALERT_EMAIL
wrangler secret put ALERT_SECRET
```

> ⚠️ **Critical:** All 3 apps must share the **same `JWT_SECRET`** and **same `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`** for the handoff-callback SSO system to work.

---

## Build & Deploy

### Deploy All Apps (Recommended)

From the monorepo root:

```bash
# 1. Install dependencies
bun install

# 2. Build all apps
bun run build

# 3. Deploy each app
cd apps/accounts && npx wrangler deploy && cd ../..
cd apps/auth && npx wrangler deploy && cd ../..
cd apps/admin && npx wrangler deploy && cd ../..
```

### Deploy a Single App

```bash
cd apps/accounts
bun run build
npx wrangler deploy
```

### What `wrangler deploy` Does

1. Uploads the built worker (`_worker.js`) to Cloudflare
2. Uploads static assets from `.svelte-kit/cloudflare/`
3. Binds the worker to the custom domain routes
4. Cloudflare automatically provisions SSL for the custom domain

---

## DNS Setup

In Cloudflare DNS for `getmaterio.app`, ensure these records exist:

| Type | Name | Content | Proxy |
|---|---|---|---|
| `CNAME` | `accounts` | `materio-accounts.<account-id>.workers.dev` | ✅ Proxied |
| `CNAME` | `auth` | `materio-auth.<account-id>.workers.dev` | ✅ Proxied |
| `CNAME` | `admin` | `materio-admin.<account-id>.workers.dev` | ✅ Proxied |
| `CNAME` | `sso` | `materio-auth.<account-id>.workers.dev` | ✅ Proxied |

> When using `custom_domain: true` in wrangler routes, Cloudflare will automatically create and manage DNS records for you. Manual DNS setup is typically not needed.

---

## Adding a New App (e.g., `home.getmaterio.app`)

### 1. Create the app

```bash
cd apps
mkdir home
cd home
npx -y sv create ./ --template minimal --types ts
bun add @sveltejs/adapter-cloudflare -D
```

### 2. Configure `svelte.config.js`

```javascript
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
  preprocess: vitePreprocess(),
  kit: { adapter: adapter() }
};

export default config;
```

### 3. Create `wrangler.jsonc`

```jsonc
{
  "name": "materio-home",
  "compatibility_date": "2026-08-22",
  "compatibility_flags": ["nodejs_als", "nodejs_compat"],
  "main": ".svelte-kit/cloudflare/_worker.js",
  "assets": { "binding": "ASSETS", "directory": ".svelte-kit/cloudflare" },
  "routes": [
    {
      "pattern": "home.getmaterio.app",
      "zone_name": "getmaterio.app",
      "custom_domain": true,
      "enabled": true
    }
  ],
  "vars": {},
  "observability": { "logs": { "enabled": true }, "traces": { "enabled": true } }
}
```

### 4. Add shared dependencies

```bash
bun add @materio/config @materio/utils @materio/ui
```

### 5. Copy `$lib/server/utils.ts`

Copy the server utilities from `apps/accounts/src/lib/server/utils.ts` (or symlink to a shared package) — this gives you `consumeHandoffCode`, `verifyToken`, etc.

### 6. Add callback + login routes

Follow the [Internal Integration Guide](./internal-integration.md) to add:
- `src/routes/auth/callback/+page.svelte`
- `src/routes/api/v2/login/+server.ts`

### 7. Register secrets and deploy

```bash
cd apps/home
wrangler secret put JWT_SECRET
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# ... (all required secrets)
bun run build
npx wrangler deploy
```

### 8. Update `@materio/config`

Add `home` to the URL resolver in `packages/config/src/urls.js`.

### 9. Update dev scripts

Add to root `package.json`:

```json
"dev:home": "bun --env-file=../../.env --cwd apps/home dev -- --port 5176"
```

And add the service to `scripts/dev-all.ts`:

```typescript
{
  name: "home",
  tag: "[home]    ",
  color: "\x1b[34m", // Blue
  port: 5176,
  cmd: ["bun", "run", "dev:home"],
}
```

---

## Local Development

Start all apps simultaneously:

```bash
bun run all
```

This runs `scripts/dev-all.ts`, which spawns all 3 (or more) dev servers with color-coded, prefixed logs:

```
🚀 Starting all 3 app servers in parallel...

  [accounts] http://localhost:5173
  [auth]     http://localhost:5174
  [admin]    http://localhost:5175
```

The `getAppUrls()` function automatically detects `localhost` and resolves to local ports instead of production domains.

---

## Environment Variables

The `.env` file at the monorepo root is loaded by Bun during local development via `--env-file`:

```env
JWT_SECRET=your_jwt_secret
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
MONGODB_URI=mongodb+srv://...
SMTP_EMAIL=your@email.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx
GITHUB_TOKEN=github_pat_...
ALERT_EMAIL=admin@example.com
ALERT_SECRET=random_secret
OAUTH_ISSUER=https://accounts.getmaterio.app
```

> In production, these are set via `wrangler secret put` (for secrets) or `vars` in `wrangler.jsonc` (for non-sensitive config).

---

## Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| Handoff codes always expire | Clocks out of sync between apps | All workers run on Cloudflare edge — same clock. If local, ensure system clock is correct. |
| `JWT_SECRET` mismatch | Apps deployed with different secrets | Re-run `wrangler secret put JWT_SECRET` for **each** app with the same value |
| CORS errors on cross-origin fetch | Direct API calls between apps | Materio avoids this by using the handoff system (server-to-DB, not app-to-app). If needed, add CORS headers to the API routes. |
| Custom domain not resolving | DNS not configured or not proxied | Verify CNAME exists in Cloudflare DNS with proxy enabled (orange cloud) |
| `adapter-cloudflare` errors | Missing compatibility flags | Ensure `"nodejs_als"` and `"nodejs_compat"` are in `compatibility_flags` |
