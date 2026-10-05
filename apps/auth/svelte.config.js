import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
		csrf: {
			// Materio ID is an OAuth 2.0 / OIDC authorization server. Its token
			// endpoint must accept application/x-www-form-urlencoded POSTs from
			// non-browser clients (RFC 6744 section 4.1.3), which send no Origin
			// header, so SvelteKit's origin check would reject them with 403.
			//
			// The app authenticates exclusively via the Authorization: Bearer header
			// and sets no cookies, so there is no ambient credential for a CSRF
			// attack to ride on. Cookie/state-changing endpoints additionally call
			// csrfGuard() from $lib/server/csrf.
			checkOrigin: false
		}
	}
};

export default config;
