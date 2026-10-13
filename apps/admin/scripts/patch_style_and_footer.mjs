import fs from 'node:fs';
import path from 'node:path';

const exodusRoot = 'D:/v4/v5/project-exodus';

// 1. Patch src/routes/[...slug]/+page.svelte
const slugSvelte = path.join(exodusRoot, 'src', 'routes', '[...slug]', '+page.svelte');
if (fs.existsSync(slugSvelte)) {
  let content = fs.readFileSync(slugSvelte, 'utf-8');

  // Replace footer card HTML
  const oldFooterHtml = `        {#if showAuthorCard}
            <!-- Byline card: author first, the category as a pill underneath. -->
            <aside class="post-author-card" aria-label="Post details">
                {#if showAuthor}
                    <div class="post-author-card-head">
                        <div class="author-avatar" style="width: 44px; height: 44px; border-radius: 50%; overflow: hidden; border: 2px solid var(--border, rgba(0,0,0,0.1)); flex: 0 0 auto;">
                            <img src="{authorAvatar}" alt="{authorName}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                        <div class="author-info">
                            <div class="author-name" style="font-size: 15px; font-weight: 600; color: var(--text); line-height: 1.2;">{authorName}</div>
                        </div>
                    </div>
                {/if}

                {#if showCategory}
                    <div class="post-author-card-category" class:with-head={showAuthor}>
                        <span class="post-category-pill">{metadata.category}</span>
                    </div>
                {/if}
            </aside>
        {/if}`;

  const newFooterHtml = `        {#if showAuthorCard}
            <!-- Minimal, neutral post footer details -->
            <footer class="post-footer-meta" aria-label="Post details">
                {#if showAuthor}
                    <div class="post-footer-author">
                        <div class="author-avatar">
                            <img src="{authorAvatar}" alt="{authorName}">
                        </div>
                        <span class="author-name">{authorName}</span>
                    </div>
                {/if}

                {#if showCategory}
                    <span class="post-category-badge">{metadata.category}</span>
                {/if}
            </footer>
        {/if}`;

  if (content.includes(oldFooterHtml)) {
    content = content.replace(oldFooterHtml, newFooterHtml);
  }

  // Replace CSS in <style>
  const oldCssPattern = `    /* The card sits directly on the reading page's background, so in dark mode
       it now takes the theme's own surface (--card-bg: #1e1e1e over the
       #121212 page) instead of the old 4%-white wash, which all but vanished
       against the near-black background. */
    .post-author-card {
        max-width: 700px;
        margin: 2rem auto 0;
        padding: 1.15rem 1.35rem;
        box-sizing: border-box;
        text-align: left;
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 14px;
        background: rgba(0, 0, 0, 0.025);
    }

    .post-author-card-head {
        display: flex;
        align-items: center;
        gap: 0.85rem;
    }

    .post-author-card-category {
        display: flex;
        align-items: center;
        gap: 0.55rem;
    }

    /* The divider only makes sense when a byline sits above it; a lone pill
       (posts that hide the author) should not open with a stray rule. */
    .post-author-card-category.with-head {
        margin-top: 0.95rem;
        padding-top: 0.85rem;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
    }

    .post-category-pill {
        display: inline-flex;
        align-items: center;
        padding: 4px 12px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        line-height: 1.4;
        color: #ff8200;
        background: rgba(255, 130, 0, 0.12);
        border: 1px solid rgba(255, 130, 0, 0.28);
    }`;

  const newCssReplacement = `    /* Minimal, neutral post footer details (no nested cards or sloppy decorators) */
    .post-footer-meta {
        max-width: 700px;
        margin: 2.75rem auto 0;
        padding-top: 1.25rem;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
        box-sizing: border-box;
    }

    .post-footer-author {
        display: inline-flex;
        align-items: center;
        gap: 0.65rem;
    }

    .author-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        overflow: hidden;
        border: 1px solid rgba(0, 0, 0, 0.08);
        flex: 0 0 auto;
    }

    .author-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .author-name {
        font-size: 14px;
        font-weight: 500;
        color: var(--text, #222);
        line-height: 1.2;
    }

    /* Neutral-colored rounded rectangle badge (clean, subtle, no neon pill) */
    .post-category-badge {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        line-height: 1.35;
        color: var(--gray, #555);
        background: rgba(0, 0, 0, 0.04);
        border: 1px solid rgba(0, 0, 0, 0.08);
        letter-spacing: 0.2px;
    }`;

  if (content.includes(oldCssPattern)) {
    content = content.replace(oldCssPattern, newCssReplacement);
  }

  // Also replace the dark mode overrides for post-author-card & post-category-pill
  const oldDarkOverrides = `    :global(body.dark-mode) .post-author-card,
    :global(html.dark-mode) .post-author-card {
        background: var(--card-bg, #1e1e1e);
        border-color: rgba(255, 255, 255, 0.14);
    }

    :global(body.dark-mode) .post-author-card-category.with-head,
    :global(html.dark-mode) .post-author-card-category.with-head {
        border-top-color: rgba(255, 255, 255, 0.12);
    }

    :global(body.dark-mode) .post-category-pill,
    :global(html.dark-mode) .post-category-pill {
        background: rgba(255, 130, 0, 0.16);
        border-color: rgba(255, 130, 0, 0.4);
        color: #ff9a33;
    }`;

  const newDarkOverrides = `    :global(body.dark-mode) .post-footer-meta,
    :global(html.dark-mode) .post-footer-meta {
        border-top-color: rgba(255, 255, 255, 0.1);
    }

    :global(body.dark-mode) .author-avatar,
    :global(html.dark-mode) .author-avatar {
        border-color: rgba(255, 255, 255, 0.12);
    }

    :global(body.dark-mode) .author-name,
    :global(html.dark-mode) .author-name {
        color: #e0e0e0;
    }

    :global(body.dark-mode) .post-category-badge,
    :global(html.dark-mode) .post-category-badge {
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(255, 255, 255, 0.1);
        color: #a0a0a0;
    }`;

  if (content.includes(oldDarkOverrides)) {
    content = content.replace(oldDarkOverrides, newDarkOverrides);
  }

  // Remove .post-author-card from media query if present
  content = content.replace(/\.post-author-card\s*\{\s*padding:\s*1rem;\s*\}/g, '');

  fs.writeFileSync(slugSvelte, content, 'utf-8');
  console.log('[patch_style] Updated src/routes/[...slug]/+page.svelte with minimal neutral footer meta');
}

// 2. Patch Code Block CSS in static/assets/style/style.css and src/lib/styles/style.css
const cssFiles = [
  path.join(exodusRoot, 'static', 'assets', 'style', 'style.css'),
  path.join(exodusRoot, 'src', 'lib', 'styles', 'style.css')
];

for (const cssFile of cssFiles) {
  if (!fs.existsSync(cssFile)) continue;
  let css = fs.readFileSync(cssFile, 'utf-8');

  // Inject --font-mono in :root if not present
  if (css.includes(':root {') && !css.includes('--font-mono:')) {
    css = css.replace(
      ':root {',
      `:root {\n  --font-mono: Consolas, 'Cascadia Code', 'Fira Code', Menlo, Monaco, monospace;`
    );
  }

  // Replace codeblock styling block
  const oldPreStart = '/* Enhanced Code block styling */';
  const oldPreEnd = '/* ===== NEW TOPIC PAGE BREAKS ===== */';

  const startIndex = css.indexOf(oldPreStart);
  const endIndex = css.indexOf(oldPreEnd);

  if (startIndex !== -1 && endIndex !== -1) {
    const newPreBlock = `/* Enhanced Code block styling: Consolas first on Windows, fully adaptive to dark mode */
pre {
  position: relative;
  margin: 1.5rem 0;
  border-radius: 10px;
  overflow: hidden;
  background: #f6f8fa;
  border: 1px solid rgba(0, 0, 0, 0.09);
  font-family: Consolas, 'Cascadia Code', 'Fira Code', Menlo, Monaco, monospace;
}

pre code {
  display: block;
  padding: 3.2rem 1.2rem 1.2rem 1.2rem;
  background: transparent;
  color: #24292f;
  overflow-x: auto;
  font-size: 0.88rem;
  line-height: 1.55;
  font-family: Consolas, 'Cascadia Code', 'Fira Code', Menlo, Monaco, monospace;
  min-height: 1.5rem;
}

pre code.hljs {
  padding: 1.2rem !important;
  padding-top: 3.2rem !important;
  background: transparent !important;
}

/* Language label */
pre .code-language {
  position: absolute;
  top: 0;
  left: 0;
  color: #6e7781;
  background: rgba(0, 0, 0, 0.04);
  font-size: 0.65rem;
  font-weight: 600;
  font-family: Consolas, 'Cascadia Code', 'Fira Code', Menlo, Monaco, monospace;
  padding: 0.3rem 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom-right-radius: 8px;
  margin: 0;
  z-index: 5;
  line-height: 1.2;
}

/* Copy button */
pre .code-copy-btn {
  position: absolute;
  top: 0.35rem;
  right: 0.65rem;
  font-size: 0.7rem;
  background: rgba(0, 0, 0, 0.06);
  color: #57606a;
  padding: 0.22rem 0.55rem;
  border-radius: 5px;
  cursor: var(--f-cursor-pointer, pointer);
  transition: background 0.15s ease, color 0.15s ease;
  z-index: 10;
  border: 1px solid rgba(0, 0, 0, 0.08);
  font-family: var(--font-primary, 'OpenRunde', 'Open Runde', sans-serif);
  line-height: 1.3;
}

pre .code-copy-btn:hover {
  background: rgba(0, 0, 0, 0.12);
  color: #24292f;
}

/* Adjust padding for code blocks without language label */
pre:not(.has-language) code {
  padding-top: 1.2rem;
}

/* Single line code blocks */
pre.single-line code {
  padding-top: 2.5rem;
  padding-bottom: 1rem;
}

/* Syntax highlighting in light mode */
.hljs {
  background: transparent !important;
  color: #24292f !important;
}
.hljs-keyword, .hljs-selector-tag { color: #cf222e !important; }
.hljs-string, .hljs-title, .hljs-section, .hljs-attribute { color: #0a3069 !important; }
.hljs-comment, .hljs-quote { color: #6e7781 !important; font-style: italic; }
.hljs-number, .hljs-literal { color: #0550ae !important; }
.hljs-function, .hljs-title.function_ { color: #8250df !important; }
.hljs-variable, .hljs-template-variable { color: #953800 !important; }
.hljs-type, .hljs-built_in { color: #116329 !important; }

/* Dark mode code blocks (body.dark-mode, html.dark-mode, amoled, coffee) */
body.dark-mode pre,
html.dark-mode pre,
body.amoled-mode pre,
html.amoled-mode pre,
body.coffee-dark-mode pre,
html.coffee-dark-mode pre {
  background: #161b22;
  border-color: rgba(255, 255, 255, 0.12);
}

body.dark-mode pre code,
html.dark-mode pre code,
body.amoled-mode pre code,
html.amoled-mode pre code,
body.coffee-dark-mode pre code,
html.coffee-dark-mode pre code {
  background: transparent;
  color: #e6edf3;
}

body.dark-mode pre .code-language,
html.dark-mode pre .code-language,
body.amoled-mode pre .code-language,
html.amoled-mode pre .code-language,
body.coffee-dark-mode pre .code-language,
html.coffee-dark-mode pre .code-language {
  color: #8b949e;
  background: rgba(255, 255, 255, 0.05);
}

body.dark-mode pre .code-copy-btn,
html.dark-mode pre .code-copy-btn,
body.amoled-mode pre .code-copy-btn,
html.amoled-mode pre .code-copy-btn,
body.coffee-dark-mode pre .code-copy-btn,
html.coffee-dark-mode pre .code-copy-btn {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
  color: #c9d1d9;
}

body.dark-mode pre .code-copy-btn:hover,
html.dark-mode pre .code-copy-btn:hover,
body.amoled-mode pre .code-copy-btn:hover,
html.amoled-mode pre .code-copy-btn:hover,
body.coffee-dark-mode pre .code-copy-btn:hover,
html.coffee-dark-mode pre .code-copy-btn:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
}

/* Syntax highlighting in dark mode */
body.dark-mode .hljs,
html.dark-mode .hljs,
body.amoled-mode .hljs,
html.amoled-mode .hljs,
body.coffee-dark-mode .hljs,
html.coffee-dark-mode .hljs {
  color: #e6edf3 !important;
}

body.dark-mode .hljs-keyword,
html.dark-mode .hljs-keyword,
body.amoled-mode .hljs-keyword,
html.amoled-mode .hljs-keyword,
body.coffee-dark-mode .hljs-keyword,
html.coffee-dark-mode .hljs-keyword,
body.dark-mode .hljs-selector-tag,
html.dark-mode .hljs-selector-tag {
  color: #ff7b72 !important;
}

body.dark-mode .hljs-string,
html.dark-mode .hljs-string,
body.amoled-mode .hljs-string,
html.amoled-mode .hljs-string,
body.coffee-dark-mode .hljs-string,
html.coffee-dark-mode .hljs-string,
body.dark-mode .hljs-title,
html.dark-mode .hljs-title {
  color: #a5d6ff !important;
}

body.dark-mode .hljs-comment,
html.dark-mode .hljs-comment,
body.amoled-mode .hljs-comment,
html.amoled-mode .hljs-comment,
body.coffee-dark-mode .hljs-comment,
html.coffee-dark-mode .hljs-comment,
body.dark-mode .hljs-quote,
html.dark-mode .hljs-quote {
  color: #8b949e !important;
}

body.dark-mode .hljs-number,
html.dark-mode .hljs-number,
body.amoled-mode .hljs-number,
html.amoled-mode .hljs-number,
body.coffee-dark-mode .hljs-number,
html.coffee-dark-mode .hljs-number,
body.dark-mode .hljs-literal,
html.dark-mode .hljs-literal {
  color: #79c0ff !important;
}

body.dark-mode .hljs-function,
html.dark-mode .hljs-function,
body.amoled-mode .hljs-function,
html.amoled-mode .hljs-function,
body.coffee-dark-mode .hljs-function,
html.coffee-dark-mode .hljs-function {
  color: #d2a8ff !important;
}

body.dark-mode .hljs-variable,
html.dark-mode .hljs-variable,
body.amoled-mode .hljs-variable,
html.amoled-mode .hljs-variable,
body.coffee-dark-mode .hljs-variable,
html.coffee-dark-mode .hljs-variable {
  color: #ffa657 !important;
}

body.dark-mode .hljs-type,
html.dark-mode .hljs-type,
body.amoled-mode .hljs-type,
html.amoled-mode .hljs-type,
body.coffee-dark-mode .hljs-type,
html.coffee-dark-mode .hljs-type,
body.dark-mode .hljs-built_in,
html.dark-mode .hljs-built_in {
  color: #7ee787 !important;
}

/* Inline code formatting */
code:not(pre code) {
  font-family: Consolas, 'Cascadia Code', 'Fira Code', Menlo, Monaco, monospace;
  font-size: 0.88em;
  padding: 0.18em 0.38em;
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.05);
  color: var(--text, #24292f);
}

body.dark-mode code:not(pre code),
html.dark-mode code:not(pre code),
body.amoled-mode code:not(pre code),
html.amoled-mode code:not(pre code),
body.coffee-dark-mode code:not(pre code),
html.coffee-dark-mode code:not(pre code) {
  background: rgba(255, 255, 255, 0.08);
  color: #e6edf3;
}

`;

    css = css.slice(0, startIndex) + newPreBlock + css.slice(endIndex);
    fs.writeFileSync(cssFile, css, 'utf-8');
    console.log(`[patch_style] Updated codeblock styles in ${path.relative(exodusRoot, cssFile)}`);
  }
}

// 3. Patch src/lib/utils/asset-loader.js to load matching highlight theme
const assetLoaderFile = path.join(exodusRoot, 'src', 'lib', 'utils', 'asset-loader.js');
if (fs.existsSync(assetLoaderFile)) {
  let loaderContent = fs.readFileSync(assetLoaderFile, 'utf-8');
  
  const oldHljsLoader = `        if (!document.querySelector('#highlight-theme') && !document.querySelector('link[href*="highlight.js"]')) {
            const link = document.createElement('link');
            link.id = 'highlight-theme';
            link.rel = 'stylesheet';
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github-dark.min.css';
            document.head.appendChild(link);
        }`;

  const newHljsLoader = `        const isDark = document.body?.classList.contains('dark-mode') ||
                       document.documentElement?.classList.contains('dark-mode') ||
                       document.body?.classList.contains('amoled-mode') ||
                       document.body?.classList.contains('coffee-dark-mode');

        let link = document.querySelector('#highlight-theme');
        if (!link) {
            link = document.createElement('link');
            link.id = 'highlight-theme';
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }
        link.href = isDark
            ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github-dark.min.css'
            : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github.min.css';`;

  if (loaderContent.includes(oldHljsLoader)) {
    loaderContent = loaderContent.replace(oldHljsLoader, newHljsLoader);
    fs.writeFileSync(assetLoaderFile, loaderContent, 'utf-8');
    console.log('[patch_style] Updated asset-loader.js for adaptive highlight themes');
  }
}

console.log('All styles and footer components successfully updated!');
