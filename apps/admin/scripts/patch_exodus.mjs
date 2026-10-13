import fs from 'node:fs';
import path from 'node:path';

const exodusRoot = 'D:/v4/v5/project-exodus';

// 1. Update [...slug]/+page.server.js
const slugFile = path.join(exodusRoot, 'src', 'routes', '[...slug]', '+page.server.js');
if (fs.existsSync(slugFile)) {
  const content = `import { error } from '@sveltejs/kit';
import matter from 'gray-matter';
import fs from 'fs';
import path from 'path';
import { POSTS_DIR, PAGES_DIR, contentFiles, isStaticRoute, postUrl, pageUrl } from '$lib/server/content.js';
import { renderMarkdown } from '$lib/server/markdown.js';
import { getMongoDb, withMongoTimeout } from '$lib/server/mongodb.js';

export const prerender = false;

export async function entries() {
    return [];
}

function excerptOf(rawContent, excerpt) {
    if (excerpt) return String(excerpt).trim();
    const { content } = matter(rawContent);
    const text = content
        .replace(/\`\`\`[\\s\\S]*?\`\`\`/g, ' ')
        .replace(/\`[^\`]*\`/g, ' ')
        .replace(/!\\[([^\\]]*)\\]\\([^)]*\\)/g, '$1')
        .replace(/\\[([^\\]]*)\\]\\([^)]*\\)/g, '$1')
        .replace(/^\\s{0,3}[#>*+-]+\\s+/gm, '')
        .replace(/[*_~\`#>|]/g, ' ')
        .replace(/\\s+/g, ' ')
        .trim();
    if (!text) return '';
    return text.length > 180 ? \`\${text.slice(0, 177).trimEnd()}…\` : text;
}

function pickRelated(index, at) {
    const current = index[at];
    if (!current) return [];
    const candidates = index.filter((entry, i) => i !== at && entry.visibility !== 'private');
    const sameCategory = current.category
        ? candidates.filter((entry) => entry.category && entry.category.toLowerCase() === current.category.toLowerCase())
        : [];
    const chosen = [
        ...sameCategory,
        ...candidates.filter((entry) => !sameCategory.includes(entry))
    ].slice(0, 3);

    return chosen.map((entry) => ({
        url: \`/\${entry.url}\`,
        title: entry.title,
        excerpt: entry.excerpt || ''
    }));
}

export async function load({ params, setHeaders }) {
    if (setHeaders) {
        setHeaders({ 'cache-control': 'public, max-age=0, must-revalidate' });
    }
    const rawSlug = String(params.slug || '').replace(/\\/$/, '');
    const cleanSlug = rawSlug.replace(/^(posts|docs|documentation|changelog)\\//, '');

    // 1. Try MongoDB first (dynamic and source of truth)
    try {
        const db = await withMongoTimeout(getMongoDb(), 4000, 'getMongoDb for slug');
        const doc = await withMongoTimeout(
            db.collection('exodus_posts').findOne({
                $or: [
                    { slug: rawSlug },
                    { slug: cleanSlug },
                    { url: \`/\${rawSlug}\` },
                    { url: rawSlug },
                    { url: \`/\${cleanSlug}\` },
                    { url: cleanSlug },
                    { filename: rawSlug },
                    { filename: \`\${cleanSlug}.md\` }
                ]
            }),
            4000,
            'findOne exodus_post'
        );

        if (doc) {
            const isPage = doc.docType === 'legal';
            let renderedHtml = '';
            try {
                renderedHtml = renderMarkdown(doc.content || '', isPage ? { title: doc.title } : {});
            } catch (renderErr) {
                console.warn('[renderMarkdown error]:', renderErr);
                renderedHtml = String(doc.content || '');
            }

            return {
                metadata: {
                    title: doc.title,
                    date: doc.date,
                    category: doc.category,
                    categories: doc.categories || [],
                    image: doc.image,
                    cover: doc.image,
                    excerpt: doc.excerpt,
                    draft: doc.draft,
                    hidden: doc.hidden,
                    visibility: doc.visibility || 'public',
                    permalink: doc.url,
                    cover_home_only: Boolean(doc.cover_home_only ?? doc.metadata?.cover_home_only ?? doc.metadata?.hide_cover_in_post),
                    hide_cover_in_post: Boolean(doc.cover_home_only ?? doc.metadata?.cover_home_only ?? doc.metadata?.hide_cover_in_post),
                    ...(doc.metadata || {})
                },
                html: renderedHtml,
                type: isPage ? 'page' : 'post',
                layout: 'bare',
                related: []
            };
        }
    } catch (mongoErr) {
        console.warn('[Exodus Post Load] Mongo query fallback:', mongoErr?.message || mongoErr);
    }

    // 2. Safe local disk posts fallback (guarded against edge fs crashes)
    try {
        if (typeof fs !== 'undefined' && fs?.existsSync && fs.existsSync(POSTS_DIR)) {
            const files = contentFiles(POSTS_DIR);
            const index = [];
            for (const filename of files) {
                try {
                    const rawContent = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf-8');
                    const slugMatch = filename.match(/^\\d{4}-\\d{2}-\\d{2}-(.+)\\.md$/);
                    const extractedSlug = slugMatch ? slugMatch[1] : filename.replace('.md', '');
                    const { data: metadata } = matter(rawContent);
                    index.push({
                        filename,
                        extractedSlug,
                        url: postUrl(metadata, extractedSlug),
                        date: metadata.date ? new Date(metadata.date).getTime() : 0,
                        title: metadata.title || extractedSlug,
                        category: metadata.category || '',
                        excerpt: metadata.excerpt || '',
                        visibility: metadata.visibility || ''
                    });
                } catch {}
            }
            index.sort((a, b) => b.date - a.date);
            const at = index.findIndex((entry) => 
                entry.url === rawSlug || 
                entry.extractedSlug === rawSlug || 
                entry.extractedSlug === cleanSlug ||
                entry.url === cleanSlug
            );
            const hit = at >= 0 ? index[at] : null;
            if (hit) {
                const rawContent = fs.readFileSync(path.join(POSTS_DIR, hit.filename), 'utf-8');
                const { data: metadata, content } = matter(rawContent);
                return {
                    metadata,
                    html: renderMarkdown(content),
                    type: 'post',
                    layout: 'bare',
                    related: pickRelated(index, at)
                };
            }
        }
    } catch {}

    // 3. Safe local disk standalone pages fallback
    try {
        if (typeof fs !== 'undefined' && fs?.existsSync && fs.existsSync(PAGES_DIR)) {
            const pageFiles = contentFiles(PAGES_DIR);
            for (const filename of pageFiles) {
                try {
                    const rawContent = fs.readFileSync(path.join(PAGES_DIR, filename), 'utf-8');
                    const { data: metadata, content } = matter(rawContent);
                    const url = pageUrl(metadata, filename);
                    if (url === rawSlug || url === cleanSlug) {
                        return {
                            metadata,
                            html: renderMarkdown(content, { title: metadata.title }),
                            type: 'page',
                            layout: 'bare'
                        };
                    }
                } catch {}
            }
        }
    } catch {}

    throw error(404, 'Post or page not found');
}
`;
  fs.writeFileSync(slugFile, content, 'utf-8');
  console.log('[patch_exodus] Updated src/routes/[...slug]/+page.server.js');
}

// 2. Update docs/+page.server.js
const docsFile = path.join(exodusRoot, 'src', 'routes', 'docs', '+page.server.js');
if (fs.existsSync(docsFile)) {
  const content = `import matter from 'gray-matter';
import fs from 'fs';
import path from 'path';
import { POSTS_DIR, contentFiles, postUrl, coverUrl } from '$lib/server/content.js';
import { getMongoDb, withMongoTimeout } from '$lib/server/mongodb.js';

export const prerender = false;

const DOC_CATEGORIES = new Set(['documentation', 'docs']);
const isDocCategory = (value) => DOC_CATEGORIES.has(String(value || '').toLowerCase());

export async function load({ setHeaders }) {
    if (setHeaders) {
        setHeaders({ 'cache-control': 'public, max-age=0, must-revalidate' });
    }
    const docs = [];
    const seenSlugs = new Set();

    // 1. Load docs from MongoDB
    try {
        const db = await withMongoTimeout(getMongoDb(), 4000, 'getMongoDb for docs');
        const mongoDocs = await withMongoTimeout(
            db.collection('exodus_posts')
                .find({ 
                    docType: 'doc',
                    draft: { $ne: true },
                    hidden: { $ne: true }
                })
                .sort({ date: -1 })
                .toArray(),
            4000,
            'find docs'
        );

        for (const d of mongoDocs) {
            seenSlugs.add(d.slug);
            const rawText = (d.content || '').replace(/<[^>]*>?/gm, '').trim();
            const excerpt = d.excerpt || (rawText.slice(0, 160) + '...');
            docs.push({
                ...(d.metadata || {}),
                title: d.title,
                date: d.date,
                category: d.category || 'Documentation',
                cover: d.image || null,
                image: d.image || null,
                slug: d.slug,
                url: \`/docs/\${d.slug}\`,
                excerpt
            });
        }
    } catch (e) {
        console.warn('[Docs Load] Mongo fetch failed, falling back to disk:', e?.message || e);
    }

    // 2. Safe disk fallback
    try {
        if (typeof fs !== 'undefined' && fs?.existsSync && fs.existsSync(POSTS_DIR)) {
            for (const filename of contentFiles(POSTS_DIR)) {
                try {
                    const slugMatch = filename.match(/^\\d{4}-\\d{2}-\\d{2}-(.+)\\.md$/);
                    const slug = slugMatch ? slugMatch[1] : filename.replace('.md', '');
                    if (seenSlugs.has(slug)) continue;

                    const rawContent = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf-8');
                    const { data: metadata, content } = matter(rawContent);

                    const category = metadata.category || '';
                    const categories = metadata.categories || [];
                    const listed = isDocCategory(category) || categories.some(isDocCategory);

                    if (listed && metadata.draft !== true && metadata.hidden !== true) {
                        const url = \`/\${postUrl(metadata, slug)}\`;
                        const rawText = content.replace(/<[^>]*>?/gm, '').trim();
                        const excerpt = metadata.excerpt || (rawText.slice(0, 160) + '...');
                        const cover = coverUrl(metadata);

                        docs.push({
                            ...metadata,
                            cover,
                            image: cover,
                            slug,
                            url,
                            excerpt
                        });
                    }
                } catch {}
            }
        }
    } catch {}

    docs.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    return { docs };
}
`;
  fs.writeFileSync(docsFile, content, 'utf-8');
  console.log('[patch_exodus] Updated src/routes/docs/+page.server.js');
}

// 3. Update changelog/+page.server.js
const changelogFile = path.join(exodusRoot, 'src', 'routes', 'changelog', '+page.server.js');
if (fs.existsSync(changelogFile)) {
  const content = `import matter from 'gray-matter';
import fs from 'fs';
import path from 'path';
import { POSTS_DIR, contentFiles, postUrl, coverUrl } from '$lib/server/content.js';
import { getMongoDb, withMongoTimeout } from '$lib/server/mongodb.js';

export const prerender = false;

export async function load({ setHeaders }) {
    if (setHeaders) {
        setHeaders({ 'cache-control': 'public, max-age=0, must-revalidate' });
    }
    const changelogs = [];
    const seenSlugs = new Set();

    // 1. Load changelogs from MongoDB
    try {
        const db = await withMongoTimeout(getMongoDb(), 4000, 'getMongoDb for changelog');
        const mongoLogs = await withMongoTimeout(
            db.collection('exodus_posts')
                .find({
                    docType: 'changelog',
                    draft: { $ne: true },
                    hidden: { $ne: true },
                    visibility: { $ne: 'private' }
                })
                .sort({ date: -1 })
                .toArray(),
            4000,
            'find changelog'
        );

        for (const l of mongoLogs) {
            seenSlugs.add(l.slug);
            const rawText = (l.content || '').replace(/<[^>]*>?/gm, '').trim();
            const postUrl = l.url && !l.url.includes('#') ? l.url : \`/changelog/\${l.slug}\`;
            changelogs.push({
                title: l.title || l.slug,
                slug: l.slug,
                date: l.date || null,
                cover: l.image || null,
                image: l.image || null,
                excerpt: l.excerpt || (rawText.slice(0, 320) + '...'),
                url: postUrl
            });
        }
    } catch (e) {
        console.warn('[Changelog Load] Mongo fetch failed, falling back to disk:', e?.message || e);
    }

    // 2. Safe disk fallback
    try {
        if (typeof fs !== 'undefined' && fs?.existsSync && fs.existsSync(POSTS_DIR)) {
            for (const filename of contentFiles(POSTS_DIR)) {
                try {
                    const slugMatch = filename.match(/^\\d{4}-\\d{2}-\\d{2}-(.+)\\.md$/);
                    const slug = slugMatch ? slugMatch[1] : filename.replace('.md', '');
                    if (seenSlugs.has(slug)) continue;

                    const rawContent = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf-8');
                    const { data: metadata, content } = matter(rawContent);

                    const category = metadata.category || '';
                    const categories = metadata.categories || [];
                    const isLog = category === 'whats-new' || categories.includes('whats-new');
                    if (!isLog || metadata.draft === true || metadata.hidden === true || metadata.visibility === 'private') continue;

                    const url = \`/changelog/\${slug}\`;
                    const rawText = content.replace(/<[^>]*>?/gm, '').trim();
                    changelogs.push({
                        title: metadata.title || slug,
                        date: metadata.date || null,
                        image: coverUrl(metadata),
                        excerpt: metadata.excerpt || (rawText.slice(0, 320) + '...'),
                        url
                    });
                } catch {}
            }
        }
    } catch {}

    changelogs.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    return { changelogs };
}
`;
  fs.writeFileSync(changelogFile, content, 'utf-8');
  console.log('[patch_exodus] Updated src/routes/changelog/+page.server.js');
}

// 4. Update room/+page.server.js
const roomFile = path.join(exodusRoot, 'src', 'routes', 'room', '+page.server.js');
if (fs.existsSync(roomFile)) {
  const content = `import matter from 'gray-matter';
import fs from 'fs';
import path from 'path';
import { getMongoDb, withMongoTimeout } from '$lib/server/mongodb.js';

export const prerender = false;

export async function load({ setHeaders }) {
    if (setHeaders) {
        setHeaders({ 'cache-control': 'public, max-age=0, must-revalidate' });
    }
    let posts = [];
    const seenSlugs = new Set();

    // 1. Load from MongoDB
    try {
        const db = await withMongoTimeout(getMongoDb(), 4000, 'getMongoDb for room');
        const mongoPosts = await withMongoTimeout(
            db.collection('exodus_posts')
                .find({
                    draft: { $ne: true },
                    hidden: { $ne: true },
                    visibility: { $ne: 'private' }
                })
                .sort({ date: -1 })
                .toArray(),
            4000,
            'find room posts'
        );

        for (const p of mongoPosts) {
            seenSlugs.add(p.slug);
            let url = p.url;
            if (!url) {
                if (p.category) {
                    url = \`/\${String(p.category).toLowerCase()}/\${p.slug}\`;
                } else {
                    url = \`/\${p.slug}\`;
                }
            } else {
                url = '/' + String(url).replace(/^\\/+/, '').replace(/\\/+$/, '');
            }

            posts.push({
                ...(p.metadata || {}),
                title: p.title,
                slug: p.slug,
                date: p.date,
                category: p.category,
                image: p.image || null,
                cover: p.image || null,
                excerpt: p.excerpt || '',
                visibility: p.visibility || 'public',
                url
            });
        }
    } catch (e) {
        console.warn('[Room Load] Mongo fetch failed, falling back to disk:', e?.message || e);
    }

    // 2. Safe disk fallback
    try {
        const postsDir = path.resolve('src/posts');
        if (typeof fs !== 'undefined' && fs?.existsSync && fs.existsSync(postsDir)) {
            const files = fs.readdirSync(postsDir).filter(file => file.endsWith('.md'));
            
            for (const filename of files) {
                try {
                    const slugMatch = filename.match(/^\\d{4}-\\d{2}-\\d{2}-(.+)\\.md$/);
                    let slug = slugMatch ? slugMatch[1] : filename.replace('.md', '');
                    if (seenSlugs.has(slug)) continue;
                    
                    const rawContent = fs.readFileSync(path.join(postsDir, filename), 'utf-8');
                    const { data: metadata } = matter(rawContent);
                    
                    if (metadata.draft !== true && metadata.hidden !== true && metadata.visibility !== 'private') {
                        let url = metadata.permalink;
                        if (!url) {
                            if (metadata.category) {
                                url = \`/\${metadata.category.toLowerCase()}/\${slug}\`;
                            } else {
                                url = \`/\${slug}\`;
                            }
                        } else {
                            url = url.replace(/^\\//, '').replace(/\\/$/, '');
                            url = \`/\${url}\`;
                        }
                        
                        posts.push({
                            ...metadata,
                            slug,
                            url
                        });
                    }
                } catch {}
            }
        }
    } catch {}
    
    // Sort by date descending
    posts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    
    return {
        posts
    };
}
`;
  fs.writeFileSync(roomFile, content, 'utf-8');
  console.log('[patch_exodus] Updated src/routes/room/+page.server.js');
}


// 5. Update svelte.config.js with handleEntryGeneratorMismatch
const svelteConfigFile = path.join(exodusRoot, 'svelte.config.js');
if (fs.existsSync(svelteConfigFile)) {
  let svelteCfg = fs.readFileSync(svelteConfigFile, 'utf-8');
  if (!svelteCfg.includes('handleEntryGeneratorMismatch')) {
    svelteCfg = svelteCfg.replace(
      "handleUnseenRoutes: 'warn'",
      "handleUnseenRoutes: 'warn',\n\t\t\thandleEntryGeneratorMismatch: 'warn'"
    );
    fs.writeFileSync(svelteConfigFile, svelteCfg, 'utf-8');
    console.log('[patch_exodus] Updated svelte.config.js');
  }
}

// 6. Update src/lib/server/content.js to be edge-safe on Cloudflare Workers
const contentJsFile = path.join(exodusRoot, 'src', 'lib', 'server', 'content.js');
if (fs.existsSync(contentJsFile)) {
  const contentJs = `import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

function findSrcDir(start) {
	if (!start) return null;
	try {
		let dir = path.resolve(start);
		for (let i = 0; i < 24; i++) {
			const src = path.join(dir, 'src');
			if (fs?.existsSync && (fs.existsSync(path.join(src, 'posts')) || fs.existsSync(path.join(src, 'pages')))) {
				return src;
			}
			const parent = path.dirname(dir);
			if (parent === dir) break;
			dir = parent;
		}
	} catch (e) {
		return null;
	}
	return null;
}

const metaUrl = typeof import.meta !== 'undefined' && import.meta?.url ? import.meta.url : null;
let selfDir = null;
try {
	if (metaUrl) selfDir = path.dirname(fileURLToPath(metaUrl));
} catch (e) {
	selfDir = null;
}
const cwd = typeof process !== 'undefined' && process?.cwd ? process.cwd() : '';
const SRC_DIR = (selfDir && findSrcDir(selfDir)) || (cwd && findSrcDir(cwd)) || (cwd ? path.join(cwd, 'src') : 'src');

export const SRC_ROOT = SRC_DIR;
export const POSTS_DIR = path.join(SRC_DIR, 'posts');
export const PAGES_DIR = path.join(SRC_DIR, 'pages');
export const ROUTES_DIR = path.join(SRC_DIR, 'routes');
export const STATIC_DIR = path.resolve(SRC_DIR, '..', 'static');

export function coverUrl(metadata) {
    const url = metadata?.cover || metadata?.image || null;
    if (!url || !String(url).startsWith('/assets/')) return url;
    try {
        if (typeof fs !== 'undefined' && fs?.existsSync) {
            const onDisk = path.join(STATIC_DIR, String(url).replace(/^\\//, ''));
            return fs.existsSync(onDisk) ? url : url;
        }
    } catch (e) {
        return url;
    }
    return url;
}

function cleanUrl(url) {
    return String(url)
        .replace(/^\\//, '')
        .replace(/\\/$/, '')
        .split('/')
        .map((seg) => seg.replace(/[<>:"|?*#%]+/g, '-'))
        .join('/');
}

export function postUrl(metadata, slug) {
    if (metadata?.permalink) {
        return cleanUrl(metadata.permalink.replace(/:title\\b/g, slug));
    }
    return metadata?.category ? \`\${String(metadata.category).toLowerCase()}/\${slug}\` : slug;
}

export function pageUrl(metadata, filename) {
    return metadata?.permalink
        ? cleanUrl(metadata.permalink)
        : cleanUrl(filename.replace(/\\.md$/, ''));
}

export function contentFiles(dir) {
	try {
		if (!fs?.existsSync || !fs.existsSync(dir)) return [];
		return fs
			.readdirSync(dir)
			.filter((file) => file.endsWith('.md'))
			.sort();
	} catch (e) {
		return [];
	}
}

export function isStaticRoute(slug) {
	try {
		const segments = String(slug).replace(/^\\/+|\\/+$/g, '').split('/').filter(Boolean);
		if (segments.length === 0) return true;
		const dir = path.join(ROUTES_DIR, ...segments);
		if (!fs?.existsSync) return false;
		return ['+page.svelte', '+page.js', '+page.server.js'].some((file) =>
			fs.existsSync(path.join(dir, file))
		);
	} catch (e) {
		return false;
	}
}
`;
  fs.writeFileSync(contentJsFile, contentJs, 'utf-8');
  console.log('[patch_exodus] Updated src/lib/server/content.js (edge-safe)');
}

console.log('All Exodus routes and content.js successfully updated to query MongoDB!');

