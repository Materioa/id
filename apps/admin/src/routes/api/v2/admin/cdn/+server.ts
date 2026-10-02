import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import * as github from './github';
import * as r2 from './r2';

/**
 * CDN backend switch.
 *
 *   CDN_BACKEND=github → old setup: GitHub repo (Materioa/cdn-materio) via Octokit. DEFAULT.
 *   CDN_BACKEND=r2     → new setup: R2 bucket + D1 metadata (Cloudflare).
 *
 * Set via Cloudflare dashboard (admin worker → Settings → Variables),
 * or .env / process env for local dev. No client changes needed:
 * both backends speak the same API contracts, and the uploads page's
 * base64 bulk-commit shape is accepted by both.
 */
function backend(platform?: any): 'github' | 'r2' {
	const v =
		platform?.env?.CDN_BACKEND ||
		(env as any)?.CDN_BACKEND ||
		(typeof process !== 'undefined' ? (process as any).env?.CDN_BACKEND : '') ||
		'github';
	return String(v).toLowerCase() === 'r2' ? 'r2' : 'github';
}

export async function GET({ request, url, platform }: { request: Request; url: URL; platform?: any }) {
	if (backend(platform) === 'r2') return r2.GET({ request, url, platform });
	return github.GET({ request, url });
}

export async function POST({ request, url, platform }: { request: Request; url: URL; platform?: any }) {
	if (backend(platform) === 'r2') return r2.POST({ request, url, platform });
	return github.POST({ request, url });
}

export async function PUT({ request, platform }: { request: Request; platform?: any }) {
	if (backend(platform) === 'r2') return r2.PUT({ request, platform });
	return github.PUT({ request });
}

export async function DELETE({ request, url, platform }: { request: Request; url: URL; platform?: any }) {
	if (backend(platform) === 'r2') return r2.DELETE({ request, url, platform });
	return github.DELETE({ request, url, platform });
}

// Health/info for the switch itself (no auth: reveals backend name only, no secrets)
export async function OPTIONS({ platform }: { platform?: any }) {
	return json({ backend: backend(platform) });
}
