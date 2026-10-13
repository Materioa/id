import fs from 'node:fs';
import path from 'node:path';

const exodusRoot = 'D:/v4/v5/project-exodus';

// =========================================================================
// 1. Update src/routes/changelog/+page.server.js
// =========================================================================
const changelogServerFile = path.join(exodusRoot, 'src', 'routes', 'changelog', '+page.server.js');
const changelogServerCode = `import matter from 'gray-matter';
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
                        slug,
                        date: metadata.date || null,
                        cover: coverUrl(metadata),
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
fs.writeFileSync(changelogServerFile, changelogServerCode, 'utf-8');
console.log('[patch] Updated src/routes/changelog/+page.server.js');

// =========================================================================
// 2. Update src/routes/changelog/+page.svelte (same layout as /docs)
// =========================================================================
const changelogSvelteFile = path.join(exodusRoot, 'src', 'routes', 'changelog', '+page.svelte');
const changelogSvelteCode = `<script>
    export let data;

    const changelogs = data.changelogs || [];

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return \`\${dd}.\${mm}.\${d.getFullYear()}\`;
    }
</script>

<svelte:head>
    <title>What's New? — Materio Changelog</title>
    <meta name="description" content="Latest releases, updates, and improvements." />
    <link rel="stylesheet" href="/assets/style/fonts-new.css" />
</svelte:head>

<div class="doc-page">
    <a href="/" class="back-link" aria-label="Go back to home" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none; opacity: 0.7; margin-bottom: 1.5rem;">
        <span>Back</span>
    </a>

    <main class="doc-main">
        <div class="docs-intro" style="text-align:center; margin-bottom:3rem;">
            <h1 style="font-size:2.5rem; font-weight:400; font-family: 'QuadrantNotepad', 'OpenRunde', sans-serif; margin: 0; letter-spacing: -0.01em;">What's New?</h1>
            <p style="color:var(--muted,#61616a); font-size:1.1rem; margin: 0.5rem 0 0 0; font-family: 'OpenRunde', sans-serif; line-height: 1.45;">Latest updates, product improvements, and release notes.</p>
        </div>

        <section class="docs-grid-section" style="max-width: 1100px; margin: 0 auto; width: 100%;">
            {#if changelogs.length === 0}
                <p style="text-align:center; color:var(--muted,#666); margin:3rem 0; font-family: 'OpenRunde', sans-serif;">No changelog entries found.</p>
            {:else}
                <div class="docs-grid">
                    {#each changelogs as post}
                        <div class="doc-grid-cell" id={post.slug}>
                            <article class="doc-item" style="display:flex; flex-direction:column; height:100%;">
                                {#if post.cover || post.image}
                                    <div class="doc-cover-container" style="margin-bottom:1.25rem; position:relative;">
                                        <a href={post.url}><img src={post.cover || post.image} alt="{post.title} cover" style="width:100%; height:180px; object-fit:cover; border-radius:8px; display:block;" /></a>
                                    </div>
                                {/if}

                                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem;">
                                    {#if post.date}
                                        <span class="date-badge" style="font-size:0.75rem; color:var(--muted,#888); font-family: 'OpenRunde', sans-serif; font-weight:500;">{formatDate(post.date)}</span>
                                    {/if}
                                </div>

                                <h2 style="margin:0 0 0.75rem 0; font-size:1.4rem; font-family: 'OpenRunde', sans-serif; font-weight: 600; line-height: 1.35;">
                                    <a href={post.url} style="color:inherit; text-decoration:none;">{post.title}</a>
                                </h2>

                                <div class="doc-body" style="display:flex; flex-direction:column; flex-grow:1; justify-content:space-between;">
                                    <a class="excerpt-link" href={post.url} style="text-decoration:none; color:inherit; display:block; margin-bottom:1.25rem;">
                                        <p class="doc-excerpt" style="margin:0; color:var(--muted,#61616a); font-size:0.95rem; line-height:1.55; font-family: 'OpenRunde', sans-serif; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">{post.excerpt}</p>
                                    </a>

                                    <div style="display:flex; align-items:center; gap:0.75rem;">
                                        <a class="read-more" href={post.url} style="font-weight:600; color:inherit; text-decoration:none; display:inline-flex; align-items:center; gap:0.5rem; font-size: 0.95rem; font-family: 'OpenRunde', sans-serif;">
                                            <span>Show changes</span>
                                            <span class="read-arrow" aria-hidden="true" style="display:inline-block;">
                                                <span class="short-arrow"></span>
                                            </span>
                                        </a>
                                    </div>
                                </div>
                            </article>
                        </div>
                    {/each}
                </div>
            {/if}
        </section>
    </main>
</div>

<style>
    .doc-page { font-family: 'OpenRunde', sans-serif; padding: 3rem 1rem; }
    .doc-main { max-width: 100%; margin: 0 auto; }
    .docs-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 3.5rem 2.5rem;
    }
    .read-more .short-arrow { display: inline-block; transition: all 0.18s ease; }
    .read-arrow .short-arrow::after { content: '>'; display: inline-block; }
    .doc-item:hover .read-arrow .short-arrow::after { content: '->'; margin-left: 6px; }
    .date-badge {
        display: inline-block;
        padding: 2px 8px;
        background: rgba(0, 0, 0, 0.04);
        border: 1px solid rgba(0, 0, 0, 0.07);
        border-radius: 4px;
    }
    :global(body.dark-mode) .date-badge,
    :global(html.dark-mode) .date-badge {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(255, 255, 255, 0.1);
        color: #999;
    }
</style>
`;
fs.writeFileSync(changelogSvelteFile, changelogSvelteCode, 'utf-8');
console.log('[patch] Updated src/routes/changelog/+page.svelte with docs-style grid');

// =========================================================================
// 3. Create src/routes/legal/+page.server.js and src/routes/legal/+page.svelte
// =========================================================================
const legalDir = path.join(exodusRoot, 'src', 'routes', 'legal');
if (!fs.existsSync(legalDir)) {
    fs.mkdirSync(legalDir, { recursive: true });
}

const legalServerCode = `import matter from 'gray-matter';
import fs from 'fs';
import path from 'path';
import { PAGES_DIR, contentFiles, coverUrl } from '$lib/server/content.js';
import { getMongoDb, withMongoTimeout } from '$lib/server/mongodb.js';

export const prerender = false;

export async function load({ setHeaders }) {
    if (setHeaders) {
        setHeaders({ 'cache-control': 'public, max-age=0, must-revalidate' });
    }
    const legalPages = [];
    const seenSlugs = new Set();

    // 1. MongoDB legal posts
    try {
        const db = await withMongoTimeout(getMongoDb(), 4000, 'getMongoDb for legal');
        const mongoDocs = await withMongoTimeout(
            db.collection('exodus_posts')
                .find({
                    docType: 'legal',
                    draft: { $ne: true },
                    hidden: { $ne: true },
                    visibility: { $ne: 'private' }
                })
                .sort({ date: -1 })
                .toArray(),
            4000,
            'find legal docs'
        );

        for (const doc of mongoDocs) {
            seenSlugs.add(doc.slug);
            const rawText = (doc.content || '').replace(/<[^>]*>?/gm, '').trim();
            legalPages.push({
                title: doc.title || doc.slug,
                slug: doc.slug,
                date: doc.date || null,
                cover: doc.image || null,
                image: doc.image || null,
                excerpt: doc.excerpt || (rawText.slice(0, 280) + '...'),
                url: doc.url || \`/\${doc.slug}\`
            });
        }
    } catch (e) {
        console.warn('[Legal Load] Mongo fetch failed, falling back to disk:', e?.message || e);
    }

    // 2. Disk fallback (src/pages/*.md: privacy, terms, cookie-policy, about)
    try {
        if (typeof fs !== 'undefined' && fs?.existsSync && fs.existsSync(PAGES_DIR)) {
            for (const filename of contentFiles(PAGES_DIR)) {
                try {
                    const slug = filename.replace(/\\.md$/, '');
                    if (seenSlugs.has(slug)) continue;

                    const rawContent = fs.readFileSync(path.join(PAGES_DIR, filename), 'utf-8');
                    const { data: metadata, content } = matter(rawContent);
                    if (metadata.draft === true || metadata.hidden === true || metadata.visibility === 'private') continue;

                    const rawText = content.replace(/<[^>]*>?/gm, '').trim();
                    legalPages.push({
                        title: metadata.title || slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
                        slug,
                        date: metadata.date || null,
                        cover: coverUrl(metadata),
                        image: coverUrl(metadata),
                        excerpt: metadata.excerpt || (rawText.slice(0, 280) + '...'),
                        url: metadata.permalink || \`/\${slug}\`
                    });
                } catch {}
            }
        }
    } catch {}

    return { legalPages };
}
`;
fs.writeFileSync(path.join(legalDir, '+page.server.js'), legalServerCode, 'utf-8');

const legalSvelteCode = `<script>
    export let data;

    const { legalPages } = data;
</script>

<svelte:head>
    <title>Legal & Policies — Materio</title>
    <meta name="description" content="Terms of service, privacy policy, and compliance documentation." />
    <link rel="stylesheet" href="/assets/style/fonts-new.css" />
</svelte:head>

<div class="doc-page">
    <a href="/" class="back-link" aria-label="Go back to home" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none; opacity: 0.7; margin-bottom: 1.5rem;">
        <span>Back</span>
    </a>

    <main class="doc-main">
        <div class="docs-intro" style="text-align:center; margin-bottom:3rem;">
            <h1 style="font-size:2.5rem; font-weight:400; font-family: 'QuadrantNotepad', 'OpenRunde', sans-serif; margin: 0; letter-spacing: -0.01em;">Legal & Policies</h1>
            <p style="color:var(--muted,#61616a); font-size:1.1rem; margin: 0.5rem 0 0 0; font-family: 'OpenRunde', sans-serif; line-height: 1.45;">Terms of service, privacy policy, and compliance documents.</p>
        </div>

        <section class="docs-grid-section" style="max-width: 1100px; margin: 0 auto; width: 100%;">
            {#if legalPages.length === 0}
                <p style="text-align:center; color:var(--muted,#666); margin:3rem 0; font-family: 'OpenRunde', sans-serif;">No legal documents found.</p>
            {:else}
                <div class="docs-grid">
                    {#each legalPages as post}
                        <div class="doc-grid-cell">
                            <article class="doc-item" style="display:flex; flex-direction:column; height:100%;">
                                {#if post.cover || post.image}
                                    <div class="doc-cover-container" style="margin-bottom:1.25rem; position:relative;">
                                        <a href={post.url}><img src={post.cover || post.image} alt="{post.title} cover" style="width:100%; height:180px; object-fit:cover; border-radius:8px; display:block;" /></a>
                                    </div>
                                {/if}

                                <h2 style="margin:0 0 0.75rem 0; font-size:1.4rem; font-family: 'OpenRunde', sans-serif; font-weight: 600; line-height: 1.35;">
                                    <a href={post.url} style="color:inherit; text-decoration:none;">{post.title}</a>
                                </h2>

                                <div class="doc-body" style="display:flex; flex-direction:column; flex-grow:1; justify-content:space-between;">
                                    <a class="excerpt-link" href={post.url} style="text-decoration:none; color:inherit; display:block; margin-bottom:1.25rem;">
                                        <p class="doc-excerpt" style="margin:0; color:var(--muted,#61616a); font-size:0.95rem; line-height:1.55; font-family: 'OpenRunde', sans-serif; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">{post.excerpt}</p>
                                    </a>

                                    <div style="display:flex; align-items:center; gap:0.75rem;">
                                        <a class="read-more" href={post.url} style="font-weight:600; color:inherit; text-decoration:none; display:inline-flex; align-items:center; gap:0.5rem; font-size: 0.95rem; font-family: 'OpenRunde', sans-serif;">
                                            <span>Read document</span>
                                            <span class="read-arrow" aria-hidden="true" style="display:inline-block;">
                                                <span class="short-arrow"></span>
                                            </span>
                                        </a>
                                    </div>
                                </div>
                            </article>
                        </div>
                    {/each}
                </div>
            {/if}
        </section>
    </main>
</div>

<style>
    .doc-page { font-family: 'OpenRunde', sans-serif; padding: 3rem 1rem; }
    .doc-main { max-width: 100%; margin: 0 auto; }
    .docs-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 3.5rem 2.5rem;
    }
    .read-more .short-arrow { display: inline-block; transition: all 0.18s ease; }
    .read-arrow .short-arrow::after { content: '>'; display: inline-block; }
    .doc-item:hover .read-arrow .short-arrow::after { content: '->'; margin-left: 6px; }
</style>
`;
fs.writeFileSync(path.join(legalDir, '+page.svelte'), legalSvelteCode, 'utf-8');
console.log('[patch] Created src/routes/legal/+page.server.js & +page.svelte');

// =========================================================================
// 4. Update src/routes/[...slug]/+page.svelte for cover_home_only & unified header
// =========================================================================
const slugSvelte = path.join(exodusRoot, 'src', 'routes', '[...slug]', '+page.svelte');
if (fs.existsSync(slugSvelte)) {
    let content = fs.readFileSync(slugSvelte, 'utf-8');

    // Replace the header block to support cover_home_only and consistent legal page layout
    const oldHeaderBlock = `        {#if type === 'post'}
        <div style="text-align: center;">
            <p class="post-title" style="font-size: 32px; font-weight: bold; margin-top: 1.5rem;">
                {metadata.title}
                {#if isPrivate}
                    <span class="private-badge"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align: -1px; margin-right: 3px;"><path d="M17 9V7a5 5 0 0 0-10 0v2H5.8A1.8 1.8 0 0 0 4 10.8v8.4A1.8 1.8 0 0 0 5.8 21h12.4a1.8 1.8 0 0 0 1.8-1.8v-8.4A1.8 1.8 0 0 0 18.2 9H17zm-2 0H9V7a3 3 0 0 1 6 0v2z"/></svg>Private</span>
                {/if}
            </p>

            {#if metadata.excerpt}
                <p class="post-description" style="font-size: 14px; margin-top: 0.5rem; color: var(--gray);">
                    {metadata.excerpt}
                </p>
            {/if}

            {#if metadata.image}
                <div style="display: block; position: relative; margin: 1.5rem auto; max-width: 700px;">
                    <div class="post-image-frame" style="padding: 5px; border-radius: 17px;">
                        {#if isVideo(metadata.image)}
                            <div class="video-cover" style="margin: 0;">
                                <video id="cover-video" muted loop style="border-radius: 12px; width: 100%;">
                                    <source src="{metadata.image}" type="{getVideoType(metadata.image)}">
                                </video>
                            </div>
                        {:else}
                            <img src="{metadata.image}" alt="Cover" class="post-cover"
                                style="border-radius: 12px; display: block; width: 100%; height: auto; object-fit: cover;" />
                        {/if}
                    </div>
                </div>
            {/if}
        </div>

        {/if}

        {#if type === 'page' && metadata.title}
             <h1 style="text-align: center; margin-bottom: 2rem;">{metadata.title}</h1>
        {/if}`;

    const newHeaderBlock = `        <div style="text-align: center;">
            <p class="post-title" style="font-size: 32px; font-weight: bold; margin-top: 1.5rem;">
                {metadata.title}
                {#if isPrivate}
                    <span class="private-badge"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align: -1px; margin-right: 3px;"><path d="M17 9V7a5 5 0 0 0-10 0v2H5.8A1.8 1.8 0 0 0 4 10.8v8.4A1.8 1.8 0 0 0 5.8 21h12.4a1.8 1.8 0 0 0 1.8-1.8v-8.4A1.8 1.8 0 0 0 18.2 9H17zm-2 0H9V7a3 3 0 0 1 6 0v2z"/></svg>Private</span>
                {/if}
            </p>

            {#if metadata.excerpt}
                <p class="post-description" style="font-size: 14px; margin-top: 0.5rem; color: var(--gray);">
                    {metadata.excerpt}
                </p>
            {/if}

            {#if (metadata.image || metadata.cover) && !metadata.cover_home_only && !metadata.hide_cover_in_post && !metadata.hide_cover}
                <div style="display: block; position: relative; margin: 1.5rem auto; max-width: 700px;">
                    <div class="post-image-frame" style="padding: 5px; border-radius: 17px;">
                        {#if isVideo(metadata.image || metadata.cover)}
                            <div class="video-cover" style="margin: 0;">
                                <video id="cover-video" muted loop style="border-radius: 12px; width: 100%;">
                                    <source src="{metadata.image || metadata.cover}" type="{getVideoType(metadata.image || metadata.cover)}">
                                </video>
                            </div>
                        {:else}
                            <img src="{metadata.image || metadata.cover}" alt="Cover" class="post-cover"
                                style="border-radius: 12px; display: block; width: 100%; height: auto; object-fit: cover;" />
                        {/if}
                    </div>
                </div>
            {/if}
        </div>`;

    if (content.includes(oldHeaderBlock)) {
        content = content.replace(oldHeaderBlock, newHeaderBlock);
        fs.writeFileSync(slugSvelte, content, 'utf-8');
        console.log('[patch] Updated src/routes/[...slug]/+page.svelte');
    }
}

// =========================================================================
// 5. Update src/lib/utils/asset-loader.js with active copy button injection
// =========================================================================
const assetLoaderFile = path.join(exodusRoot, 'src', 'lib', 'utils', 'asset-loader.js');
if (fs.existsSync(assetLoaderFile)) {
    let loaderContent = fs.readFileSync(assetLoaderFile, 'utf-8');

    const oldRenderFunc = `export function renderFormulasAndCode(container) {
    if (!container || typeof window === 'undefined') return;

    if (window.hljs) {
        container.querySelectorAll('pre code').forEach((block) => {
            try {
                window.hljs.highlightElement(block);
            } catch {}
        });
    }`;

    const newRenderFunc = `export function renderFormulasAndCode(container) {
    if (!container || typeof window === 'undefined') return;

    if (window.hljs) {
        container.querySelectorAll('pre code').forEach((block) => {
            try {
                window.hljs.highlightElement(block);
            } catch {}
        });
    }

    // Attach functional copy buttons & language tags to codeblocks
    container.querySelectorAll('pre').forEach((pre) => {
        const code = pre.querySelector('code');
        if (!code) return;

        if (!pre.querySelector('.code-copy-btn')) {
            const btn = document.createElement('button');
            btn.className = 'code-copy-btn';
            btn.type = 'button';
            btn.setAttribute('aria-label', 'Copy code to clipboard');
            btn.innerHTML = '<span class="copy-label">Copy</span>';

            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                    await navigator.clipboard.writeText(code.innerText || code.textContent || '');
                    btn.innerHTML = '<span class="copy-label">Copied!</span>';
                    btn.classList.add('copied');
                    setTimeout(() => {
                        btn.innerHTML = '<span class="copy-label">Copy</span>';
                        btn.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    console.warn('Copy failed:', err);
                }
            });

            pre.appendChild(btn);
        }

        if (!pre.querySelector('.code-language')) {
            const classes = Array.from(code.classList);
            const langClass = classes.find((c) => c.startsWith('language-'));
            if (langClass) {
                const lang = langClass.replace('language-', '').trim();
                if (lang && lang !== 'plaintext') {
                    pre.classList.add('has-language');
                    const badge = document.createElement('span');
                    badge.className = 'code-language';
                    badge.textContent = lang;
                    pre.appendChild(badge);
                }
            }
        }
    });`;

    if (loaderContent.includes(oldRenderFunc)) {
        loaderContent = loaderContent.replace(oldRenderFunc, newRenderFunc);
        fs.writeFileSync(assetLoaderFile, loaderContent, 'utf-8');
        console.log('[patch] Updated src/lib/utils/asset-loader.js with copy buttons');
    }
}

// =========================================================================
// 6. Update style.css (neutral, untinted across all themes + copy button style)
// =========================================================================
const cssFiles = [
    path.join(exodusRoot, 'static', 'assets', 'style', 'style.css'),
    path.join(exodusRoot, 'src', 'lib', 'styles', 'style.css')
];

for (const cssFile of cssFiles) {
    if (!fs.existsSync(cssFile)) continue;
    let css = fs.readFileSync(cssFile, 'utf-8');

    // Add untinted overrides for coffee, amoled, dark, and light
    const untintedBlock = `
/* Untinted Codeblock Rules: pure neutral grayscale across all themes */
body.coffee-mode pre,
html.coffee-mode pre {
  background: #f6f8fa !important;
  border-color: rgba(0, 0, 0, 0.09) !important;
}

body.coffee-mode pre code,
html.coffee-mode pre code {
  color: #24292f !important;
}

body.coffee-mode pre .code-copy-btn,
html.coffee-mode pre .code-copy-btn {
  background: rgba(0, 0, 0, 0.06) !important;
  border-color: rgba(0, 0, 0, 0.08) !important;
  color: #57606a !important;
}

body.amoled-mode pre,
html.amoled-mode pre {
  background: #000000 !important;
  border-color: rgba(255, 255, 255, 0.16) !important;
}

body.amoled-mode pre code,
html.amoled-mode pre code {
  color: #e6edf3 !important;
}

pre .code-copy-btn.copied {
  background: rgba(46, 160, 67, 0.15) !important;
  border-color: rgba(46, 160, 67, 0.4) !important;
  color: #2da44e !important;
}

body.dark-mode pre .code-copy-btn.copied,
html.dark-mode pre .code-copy-btn.copied,
body.amoled-mode pre .code-copy-btn.copied,
html.amoled-mode pre .code-copy-btn.copied,
body.coffee-dark-mode pre .code-copy-btn.copied,
html.coffee-dark-mode pre .code-copy-btn.copied {
  background: rgba(46, 160, 67, 0.2) !important;
  border-color: rgba(46, 160, 67, 0.5) !important;
  color: #3fb950 !important;
}
`;

    if (!css.includes('/* Untinted Codeblock Rules:')) {
        css += untintedBlock;
        fs.writeFileSync(cssFile, css, 'utf-8');
        console.log(`[patch] Added untinted styles to ${path.relative(exodusRoot, cssFile)}`);
    }
}

console.log('All patches successfully written!');
