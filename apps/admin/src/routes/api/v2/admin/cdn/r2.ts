import { json } from '@sveltejs/kit';
import { verifyToken, supabaseAdmin } from '$lib/server/utils';
import { env } from '$env/dynamic/private';

/**
 * Materio CDN admin API — R2 (files) + D1 (metadata) backend.
 * Replaces the old GitHub-via-Octokit implementation.
 *
 * Contracts preserved for the admin UI (uploads + files pages):
 *   GET    cdn?path=<key|prefix>            -> file {name,path,type:'file',size,download_url,content?,encoding?}
 *                                             or dir [{name,path,type,size,download_url}]
 *   POST   cdn  multipart {path,file}       -> {success,path}            (single-file upload/replace)
 *   POST   cdn  json {path,type:'directory'}-> {success,path}            (mkdir placeholder)
 *   POST   cdn?commit=true multipart        -> {success,uploaded,commit} (bulk PDF upload)
 *     fields: manifest=json [{path,category}], file_0..file_N (binaries, same order as manifest)
 *     ALSO accepts legacy {stagedFiles:[{path,content:base64,category}],autoPushNotify,commitMessage}
 *   PUT    cdn  {oldPath,newPath}           -> {success,oldPath,newPath} (rename)
 *   DELETE cdn?path=<key|prefix>            -> {success,path,deletedCount,resourceLibUpdated}
 */

function cdnBase(platform?: any): string {
	return (
		platform?.env?.PUBLIC_CDN_BASE ||
		(env as any)?.PUBLIC_CDN_BASE ||
		'https://cdn.getmaterio.app'
	);
}

function r2(platform?: any): R2Bucket | null {
	return (platform?.env?.MATERIO_CDN as R2Bucket) || null;
}

function d1(platform?: any): D1Database | null {
	return (platform?.env?.materio_cdn as D1Database) || null;
}

function kv(platform?: any): KVNamespace | null {
	return (platform?.env?.materio_cdn_cache as KVNamespace) || null;
}

async function checkAdmin(request: Request) {
	const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
	const token = authHeader.split(' ')[1];
	const user = await verifyToken(token);
	if (!user || !user.id) return null;
	const { data } = await supabaseAdmin.from('users').select('has_admin_privileges').eq('id', user.id).single();
	if (data?.has_admin_privileges !== true) return null;
	return user;
}

function requireBindings(platform?: any) {
	const bucket = r2(platform);
	if (!bucket) throw new Response(JSON.stringify({ error: 'R2 bucket not configured. Enable R2 and redeploy.' }), { status: 503 });
	return bucket;
}

function slug(s: string): string {
	return s.trim().toLowerCase().replace(/_+/g, '-').replace(/\s+/g, '-');
}

function mimeFor(key: string): string {
	const lower = key.toLowerCase();
	if (lower.endsWith('.pdf')) return 'application/pdf';
	if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
	if (lower.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
	if (lower.endsWith('.txt')) return 'text/plain; charset=utf-8';
	if (lower.endsWith('.json')) return 'application/json';
	return 'application/octet-stream';
}

function downloadUrl(platform: any, key: string): string {
	const base = cdnBase(platform).replace(/\/+$/, '');
	return `${base}/${key.split('/').map((s) => encodeURIComponent(s)).join('/')}`;
}

/** Upsert one R2 object into D1 metadata. Only pdfs/{sem}/{subject}/... paths become resources. */
async function upsertResource(db: D1Database | null, key: string, size: number, category: string | null, userId?: string) {
	if (!db) return false;
	const parts = key.split('/');
	if (parts[0] !== 'pdfs' || parts.length < 3) return false;
	const sem = parts[1];
	const subjectDisplay = parts[2];
	const filename = parts[parts.length - 1];
	if (filename === '.gitkeep') return false;
	const title = filename.replace(/\.[^/.]+$/, '');
	const now = Math.floor(Date.now() / 1000);
	const subjSlug = slug(subjectDisplay);
	const subjId = `${sem}::${subjSlug}`;
	const id = crypto.randomUUID();
	const vault = /\/vault\//i.test(key) ? 1 : 0;
	try {
		await db.batch([
			db.prepare(`INSERT OR IGNORE INTO semesters(id,label) VALUES(?1,?2)`).bind(sem, `Semester ${sem}`),
			db.prepare(`INSERT OR IGNORE INTO subjects(id,sem_id,name,slug) VALUES(?1,?2,?3,?4)`).bind(subjId, sem, subjectDisplay, subjSlug),
			db.prepare(
				`INSERT INTO resources(id,sem_id,subject_id,category,title,r2_key,legacy_path,size_bytes,mime,vault,created_by,created_at,updated_at)
				 VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)
				 ON CONFLICT(r2_key) DO UPDATE SET size_bytes=excluded.size_bytes, category=excluded.category, title=excluded.title, updated_at=excluded.updated_at`
			).bind(id, sem, subjectDisplay, category || 'Chapters', title, key, key, size, mimeFor(key), vault, userId || null, now, now)
		]);
		return true;
	} catch (e) {
		console.error('upsertResource failed:', e);
		return false;
	}
}

async function bumpCacheVersion(platform?: any) {
	const db = d1(platform);
	const cache = kv(platform);
	const v = String(Date.now());
	try {
		await db?.prepare(`INSERT INTO meta(key,value) VALUES('cache_version',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).bind(v).run();
	} catch { /* meta may not exist in odd states */ }
	try {
		await cache?.delete('lib:latest');
	} catch { /* ignore */ }
	// Ask the CDN worker to drop edge-cache entries (best effort, non-fatal)
	const secret = platform?.env?.ADMIN_REVALIDATE_SECRET || (env as any)?.ADMIN_REVALIDATE_SECRET;
	if (secret) {
		try {
			await fetch(`${cdnBase(platform).replace(/\/+$/, '')}/api/v2/admin/revalidate`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ keys: [] })
			});
		} catch { /* worker may not be deployed yet */ }
	}
	return v;
}

// ---------------------------------------------------------------- GET
export async function GET({ request, url, platform }: { request: Request; url: URL; platform?: any }) {
	const user = await checkAdmin(request);
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
	const path = (url.searchParams.get('path') || '').replace(/^\/+|\/+$/g, '');

	// Legacy JSON shims: serve via CDN worker's D1-backed routes (keeps download_url contract)
	if (path === 'databases/semester-subjects.json' || path === 'databases/beta/examdata.json' || path === 'notifications.json' || path.startsWith('databases/')) {
		return json({ name: path.split('/').pop(), path, type: 'file', size: 0, download_url: `${cdnBase(platform).replace(/\/+$/, '')}/${path}` });
	}

	try {
		const bucket = requireBindings(platform);
		if (!path) {
			// root listing: top-level prefixes
			const listed = await bucket.list({ delimiter: '/' });
			const items = [
				...(listed.delimitedPrefixes || []).map((p) => ({ name: p.replace(/\/$/, ''), path: p.replace(/\/$/, ''), type: 'directory', size: 0, download_url: '' })),
				...listed.objects.map((o) => ({ name: o.key.split('/').pop(), path: o.key, type: 'file', size: o.size, download_url: downloadUrl(platform, o.key) }))
			];
			return json(items);
		}

		// Exact object?
		const head = await bucket.head(path);
		if (head) {
			const res: any = { name: path.split('/').pop(), path, type: 'file', size: head.size, download_url: downloadUrl(platform, path) };
			// Small-file inline content for the files-page editor (mirrors old GitHub behavior)
			if (head.size > 0 && head.size < 1024 * 1024) {
				const obj = await bucket.get(path);
				if (obj) {
					const buf = await obj.arrayBuffer();
					res.content = Buffer.from(buf).toString('base64');
					res.encoding = 'base64';
				}
			}
			return json(res);
		}

		// Prefix listing
		const listed = await bucket.list({ prefix: path.endsWith('/') ? path : path + '/', delimiter: '/' });
		const listed2 = await bucket.list({ prefix: path, delimiter: '/' });
		const seen = new Map<string, any>();
		for (const l of [listed, listed2]) {
			for (const p of l.delimitedPrefixes || []) {
				const clean = p.replace(/\/$/, '');
				if (!seen.has(clean)) seen.set(clean, { name: clean.split('/').pop(), path: clean, type: 'directory', size: 0, download_url: '' });
			}
			for (const o of l.objects) {
				if (!seen.has(o.key)) seen.set(o.key, { name: o.key.split('/').pop(), path: o.key, type: 'file', size: o.size, download_url: downloadUrl(platform, o.key) });
			}
		}
		if (seen.size === 0) return json({ error: `Path "${path}" does not exist` }, { status: 404 });
		return json([...seen.values()]);
	} catch (e: any) {
		if (e instanceof Response) return e;
		console.error('CDN GET error:', e);
		return json({ error: e.message }, { status: 500 });
	}
}

// ---------------------------------------------------------------- POST
export async function POST({ request, url, platform }: { request: Request; url: URL; platform?: any }) {
	const user = await checkAdmin(request);
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const bucket = requireBindings(platform);
		const db = d1(platform);
		const isCommit = url.searchParams.get('commit') === 'true';
		const contentType = request.headers.get('content-type') || '';

		// ---- bulk commit: multipart binaries + manifest (new) OR legacy base64 stagedFiles ----
		if (isCommit) {
			let items: { path: string; category: string; data: ArrayBuffer; size: number }[] = [];
			let autoPushNotify = true;
			let commitMessage = '';

			if (contentType.includes('multipart/form-data')) {
				const form = await request.formData();
				const manifestRaw = form.get('manifest') as string;
				const manifest = JSON.parse(manifestRaw || '[]') as { path: string; category: string }[];
				commitMessage = (form.get('commitMessage') as string) || '';
				autoPushNotify = (form.get('autoPushNotify') as string) !== 'false';
				for (let i = 0; i < manifest.length; i++) {
					const f = form.get(`file_${i}`) as File | null;
					if (!f) throw new Error(`Missing binary for ${manifest[i].path}`);
					const buf = await f.arrayBuffer();
					items.push({ path: manifest[i].path, category: manifest[i].category, data: buf, size: buf.byteLength });
				}
			} else {
				// legacy shape from older admin clients: {stagedFiles:[{path,content:base64,category}],...}
				const body = (await request.json()) as any;
				autoPushNotify = body.autoPushNotify !== false;
				commitMessage = body.commitMessage || '';
				for (const f of body.stagedFiles || []) {
					const buf = Buffer.from(f.content, 'base64');
					items.push({ path: f.path, category: f.category, data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, size: buf.byteLength });
				}
				for (const f of body.stagedJsonFiles || []) {
					const key = f.path.replace(/^\/+/, '');
					await bucket.put(key, f.content, { httpMetadata: { contentType: 'application/json' } });
				}
			}

			if (items.length === 0) return json({ error: 'No files to commit' }, { status: 400 });

			let uploaded = 0;
			const subjects = new Set<string>();
			const categories = new Set<string>();
			for (const it of items) {
				const key = it.path.replace(/^\/+/, '');
				await bucket.put(key, it.data, { httpMetadata: { contentType: mimeFor(key) } });
				await upsertResource(db, key, it.size, it.category, user.id);
				uploaded++;
				const parts = key.split('/');
				if (parts[2]) subjects.add(parts[2]);
				if (it.category) categories.add(it.category);
			}

			if (autoPushNotify && db) {
				try {
					await db.prepare(`INSERT INTO notifications(id,title,message,date,links,created_at) VALUES(?1,?2,?3,?4,?5,?6)`).bind(
						crypto.randomUUID(),
						'New Materials Uploaded!',
						`New materials have been added in ${[...categories].join(', ') || 'General'} category of ${[...subjects].join(', ') || 'library'}.`,
						new Date().toISOString(),
						'[]',
						Math.floor(Date.now() / 1000)
					).run();
				} catch (e) {
					console.error('notification insert failed:', e);
				}
			}

			await bumpCacheVersion(platform);
			return json({ success: true, uploaded, commit: commitMessage || `Bulk upload of ${uploaded} files via Materio CMS` });
		}

		// ---- single file / mkdir ----
		if (contentType.includes('multipart/form-data')) {
			const form = await request.formData();
			const path = ((form.get('path') as string) || '').replace(/^\/+/, '');
			const category = (form.get('category') as string) || 'Chapters';
			const file = form.get('file') as File | null;
			if (!file || !path) return json({ error: 'Missing file or path' }, { status: 400 });
			const buf = await file.arrayBuffer();
			await bucket.put(path, buf, { httpMetadata: { contentType: (file as File).type || mimeFor(path) } });
			await upsertResource(db, path, buf.byteLength, category, user.id);
			await bumpCacheVersion(platform);
			return json({ success: true, path });
		}

		const body = (await request.json().catch(() => ({}))) as any;
		if (body.type === 'directory') {
			const folderPath = body.path ? `${(body.path as string).replace(/^\/+|\/+$/g, '')}/.gitkeep` : '.gitkeep';
			await bucket.put(folderPath, '', { httpMetadata: { contentType: 'text/plain' } });
			return json({ success: true, path: body.path });
		}
		return json({ error: 'Invalid request' }, { status: 400 });
	} catch (e: any) {
		if (e instanceof Response) return e;
		console.error('CDN POST error:', e);
		return json({ error: e.message }, { status: 500 });
	}
}

// ---------------------------------------------------------------- PUT (rename)
export async function PUT({ request, platform }: { request: Request; platform?: any }) {
	const user = await checkAdmin(request);
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
	try {
		const bucket = requireBindings(platform);
		const db = d1(platform);
		const { oldPath, newPath } = (await request.json()) as any;
		if (!oldPath || !newPath) return json({ error: 'Missing oldPath or newPath' }, { status: 400 });
		const cleanOld = oldPath.replace(/^\/+/, '');
		const cleanNew = newPath.replace(/^\/+/, '');

		const obj = await bucket.get(cleanOld);
		if (!obj) return json({ error: `Path "${cleanOld}" does not exist` }, { status: 404 });
		if (obj.size > 100 * 1024 * 1024) return json({ error: 'File too large to rename via API' }, { status: 400 });

		const buf = await obj.arrayBuffer();
		await bucket.put(cleanNew, buf, { httpMetadata: { contentType: obj.httpMetadata?.contentType || mimeFor(cleanNew) } });
		await bucket.delete(cleanOld);

		if (db) {
			try {
				const categoryRow = await db.prepare(`SELECT category FROM resources WHERE r2_key=?1`).bind(cleanOld).first<{ category: string }>().catch(() => null);
				await db.prepare(`DELETE FROM resources WHERE r2_key=?1`).bind(cleanOld).run();
				await upsertResource(db, cleanNew, buf.byteLength, categoryRow?.category || 'Chapters', user.id);
			} catch (e) {
				console.error('rename D1 sync failed:', e);
			}
		}
		await bumpCacheVersion(platform);
		return json({ success: true, oldPath: cleanOld, newPath: cleanNew });
	} catch (e: any) {
		if (e instanceof Response) return e;
		console.error('CDN PUT error:', e);
		return json({ error: e.message }, { status: 500 });
	}
}

// ---------------------------------------------------------------- DELETE
export async function DELETE({ request, url, platform }: { request: Request; url: URL; platform?: any }) {
	const user = await checkAdmin(request);
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
	const rawPath = url.searchParams.get('path');
	if (!rawPath) return json({ error: 'Path is required' }, { status: 400 });
	const cleanPath = rawPath.replace(/^\/+|\/+$/g, '');
	if (!cleanPath) return json({ error: 'Cannot delete root' }, { status: 400 });

	try {
		const bucket = requireBindings(platform);
		const db = d1(platform);

		const head = await bucket.head(cleanPath);
		let keys: string[] = [];
		if (head) {
			keys = [cleanPath];
		} else {
			let cursor: string | undefined;
			do {
				const listed = await bucket.list({ prefix: cleanPath + '/', cursor });
				keys.push(...listed.objects.map((o) => o.key));
				cursor = listed.truncated ? listed.cursor : undefined;
			} while (cursor);
			if (keys.length === 0) return json({ error: `Path "${cleanPath}" does not exist` }, { status: 404 });
		}

		await bucket.delete(keys);

		let resourceLibUpdated = false;
		if (db) {
			try {
				for (let i = 0; i < keys.length; i += 100) {
					const chunk = keys.slice(i, i + 100);
					await db.batch(chunk.map((k) => db.prepare(`DELETE FROM resources WHERE r2_key=?1`).bind(k)));
				}
				// Drop subjects left with no resources under the deleted prefix
				const empties = await db.prepare(
					`SELECT s.id FROM subjects s LEFT JOIN resources r ON r.sem_id=s.sem_id AND r.subject_id=s.name WHERE r.id IS NULL`
				).all<{ id: string }>().catch(() => ({ results: [] as { id: string }[] }));
				for (const e of empties.results || []) {
					await db.prepare(`DELETE FROM subjects WHERE id=?1`).bind(e.id).run().catch(() => {});
				}
				resourceLibUpdated = keys.length > 0;
			} catch (e) {
				console.error('delete D1 sync failed:', e);
			}
		}

		await bumpCacheVersion(platform);
		return json({ success: true, path: cleanPath, deletedCount: keys.length, resourceLibUpdated });
	} catch (e: any) {
		if (e instanceof Response) return e;
		console.error('CDN DELETE error:', e);
		return json({ error: e.message }, { status: 500 });
	}
}
