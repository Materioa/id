/* src/lib/utils/postBaseLogic.js */
// @ts-nocheck

export function initializePostBase() {
    import('@highlighters/svelte').then(({ highlight }) => {
        window.__svelte_highlighter_action = highlight;
        initializeHighlighters();
    }).catch(e => console.error('Highlighter failed to load:', e));

    if (typeof window === 'undefined') return;

    initializeBlankCharFix();
    initializeCodeBlocks();
    processGitHubCallouts();
    processAttachmentTags();
    initializeAttachmentCards(); // Initialize previews for server-rendered tags
    processVideoTags();
    initializePrintEnhancements();
    initializeSecureMode();
    initializeMermaid();
    initializeMarkmap();
    initializeGraphviz();
    initializeFlashcards();
    initializeMCQSystem();
    initializeArtifacts();
    if (window.__svelte_highlighter_action) {
        initializeHighlighters();
    }
}

function initializeHighlighters() {
    document.querySelectorAll('mark.custom-highlight').forEach(mark => {
        if (mark.dataset.highlighterInitialized) return;
        mark.dataset.highlighterInitialized = 'true';
        
        const highlight = window.__svelte_highlighter_action;
        if (!highlight) return;
        
        const opts = {
            color: { swatch: '#ff9800' } // Default orange highlighter
        };
        
        if (mark.dataset.swatch || mark.dataset.palette) {
            if (mark.dataset.swatch) opts.color.swatch = mark.dataset.swatch;
            if (mark.dataset.palette) opts.color.palette = mark.dataset.palette;
        }
        
        // Apply the Svelte action manually
        highlight(mark, opts);
    });
}

function initializeBlankCharFix() {
    // Blank characters are resolved server-side before parsing/rendering HTML to avoid breaking Svelte hydration.
}

/* =========================================
   Code Block Enhancements
   ========================================= */

function initializeCodeBlocks() {
    // Wrap tables
    document.querySelectorAll('table').forEach(function (table) {
        if (table.parentElement && table.parentElement.classList.contains('table-wrapper')) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'table-wrapper';
        if (table.parentNode) {
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    });

    // Process code blocks
    document.querySelectorAll('pre code').forEach(function (codeBlock) {
        const pre = codeBlock.parentElement;
        if (!pre) return;
        if (pre.dataset.initialized) return;
        pre.dataset.initialized = 'true';

        const classList = codeBlock.className;
        let language = '';

        // Detection logic
        const rougeMatch = classList.match(/(?:^|\s)language-([a-zA-Z0-9-]+)(?:\s|$)/);
        if (rougeMatch) language = rougeMatch[1];

        if (!language) {
            const hlMatch = classList.match(/(?:^|\s)(?:hljs-|hljs )([a-zA-Z0-9-]+)(?:\s|$)/);
            if (hlMatch) language = hlMatch[1];
        }

        if (!language) {
            const parentMatch = pre.className.match(/(?:^|\s)language-([a-zA-Z0-9-]+)(?:\s|$)/);
            if (parentMatch) language = parentMatch[1];
        }

        // Auto-detection fallback
        if (!language && codeBlock.textContent) {
            const txt = codeBlock.textContent.toLowerCase();
            if (txt.includes('func ') && txt.includes('package ')) language = 'go';
            else if (txt.includes('function ') || txt.includes('const ') || txt.includes('=>')) language = 'javascript';
            else if (txt.includes('public class')) language = 'java';
            else if (txt.includes('def ') && txt.includes('print(')) language = 'python';
        }

        // Mermaid, Markmap, Graphviz, Flashcards handling - skip here, handled separately
        if (['mermaid', 'markmap', 'graphviz', 'dot', 'flashcards'].includes(language)) return;

        const content = codeBlock.textContent || '';
        const lineCount = content.trim().split('\n').length;
        if (lineCount <= 1) pre.classList.add('single-line');

        if (language) {
            pre.classList.add('has-language');
            const langLabel = document.createElement('div');
            langLabel.className = 'code-language';
            langLabel.textContent = language.toUpperCase();
            pre.insertBefore(langLabel, codeBlock);
        }

        // Restore visible copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-code-button';
        copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> ';
        copyBtn.setAttribute('aria-label', 'Copy code to clipboard');
        copyBtn.title = 'Copy code';
        
        copyBtn.addEventListener('click', () => {
            const textToCopy = codeBlock.textContent || '';
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> ';
                    setTimeout(() => copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> ', 2000);
                }).catch(() => fallbackCopyToClipboard(textToCopy, copyBtn));
            } else {
                fallbackCopyToClipboard(textToCopy, copyBtn);
            }
        });
        
        pre.appendChild(copyBtn);
        // No visible copy button needed
    });
}

/**
 * @param {string} text
 * @param {HTMLElement} button
 */
function fallbackCopyToClipboard(text, button) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        // @ts-ignore
        const successful = document.execCommand('copy');
        if (successful) {
            button.innerHTML = ' ';
            setTimeout(() => button.innerHTML = '<i class="fa-regular fa-copy"></i> ', 2000);
        }
    } catch (err) {
        button.innerHTML = 'Error';
    }
    document.body.removeChild(textArea);
}

/* =========================================
   Mermaid Diagrams
   ========================================= */

function initializeMermaid() {
    // @ts-ignore
    if (typeof mermaid === 'undefined') return;

    // @ts-ignore
    mermaid.initialize({
        startOnLoad: false,
        theme: (document.body.classList.contains('dark') || document.body.classList.contains('dark-mode')) ? 'dark' : 'default',
        securityLevel: 'loose',
        fontFamily: 'system-ui, -apple-system, sans-serif'
    });

    const mermaidBlocks = document.querySelectorAll('pre code.language-mermaid');
    mermaidBlocks.forEach(element => {
        const code = element.textContent || '';
        const div = document.createElement('div');
        div.className = 'mermaid-diagram';
        div.style.textAlign = 'center';
        div.textContent = code;
        div.setAttribute('data-mermaid-src', code);

        const pre = element.parentElement;
        if (pre && pre.parentElement) {
            pre.replaceWith(div);
        } else if (pre) {
            pre.replaceWith(div);
        }
    });

    // mermaid.init is deprecated in v10+ and handled asynchronously in +page.svelte via mermaid.run
}

/* =========================================
   Markmap Mindmaps
   ========================================= */

function initializeMarkmap() {
    // @ts-ignore
    if (typeof markmap === 'undefined' || typeof markmap.Transformer === 'undefined') {
        console.warn('Markmap library not loaded');
        return;
    }

    const markmapBlocks = document.querySelectorAll('pre code.language-markmap');
    if (markmapBlocks.length === 0) return;

    // @ts-ignore
    const transformer = new markmap.Transformer();

    markmapBlocks.forEach((element, index) => {
        const code = element.textContent || '';
        const pre = element.parentElement;
        if (!pre || !pre.parentElement) return;

        // Create mindmap card container
        const card = document.createElement('div');
        card.className = 'mindmap-card';
        card.id = `mindmap-${index}`;

        // Create SVG for the mindmap
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = `mindmap-svg-${index}`;
        svg.style.width = '100%';
        svg.style.height = '400px';

        card.appendChild(svg);
        pre.replaceWith(card);

        try {
            // Transform markdown to markmap data
            const { root } = transformer.transform(code);

            // Create markmap instance with interactivity
            // @ts-ignore
            const mm = markmap.Markmap.create(svg, {
                colorFreezeLevel: 2,
                duration: 300,
                maxWidth: 200,
                zoom: true,
                pan: true,
            }, root);

            // Automatically fit the map to the frame after rendering
            setTimeout(() => {
                if (mm && typeof mm.fit === 'function') {
                    mm.fit();
                }
            }, 100);
            
            // Re-fit on resize
            const resizeObserver = new ResizeObserver(() => {
                if (mm && typeof mm.fit === 'function') {
                    mm.fit();
                }
            });
            resizeObserver.observe(card);

            // Add custom controls (+, -, fit to frame)
            const toolbar = document.createElement('div');
            toolbar.className = 'mindmap-controls';
            toolbar.innerHTML = `
                <button class="mindmap-ctrl-btn zoom-in" title="Zoom In"><i class="fa-solid fa-plus"></i></button>
                <button class="mindmap-ctrl-btn zoom-out" title="Zoom Out"><i class="fa-solid fa-minus"></i></button>
                <button class="mindmap-ctrl-btn fit-frame" title="Fit to Frame"><i class="fa-solid fa-expand"></i></button>
            `;
            card.appendChild(toolbar);

            toolbar.querySelector('.zoom-in').addEventListener('click', () => {
                if (mm && typeof mm.rescale === 'function') mm.rescale(1.25);
            });
            toolbar.querySelector('.zoom-out').addEventListener('click', () => {
                if (mm && typeof mm.rescale === 'function') mm.rescale(0.8);
            });
            toolbar.querySelector('.fit-frame').addEventListener('click', () => {
                if (mm && typeof mm.fit === 'function') mm.fit();
            });
        } catch (e) {
            console.error('Markmap render error:', e);
            card.innerHTML = `<div class="diagram-error">Error rendering mindmap: ${e.message}</div>`;
        }
    });
}

/* =========================================
   Graphviz FSM/Automata Diagrams
   ========================================= */

async function initializeGraphviz() {
    // @ts-ignore
    if (typeof Viz === 'undefined') {
        console.warn('Viz.js library not loaded');
        return;
    }

    const graphvizBlocks = document.querySelectorAll('pre code.language-graphviz, pre code.language-dot');
    if (graphvizBlocks.length === 0) return;

    try {
        // @ts-ignore
        const viz = await Viz.instance();

        graphvizBlocks.forEach((element, index) => {
            const code = element.textContent || '';
            const pre = element.parentElement;
            if (!pre || !pre.parentElement) return;

            // Create graphviz diagram container
            const container = document.createElement('div');
            container.className = 'graphviz-diagram';
            container.id = `graphviz-${index}`;

            try {
                // Render DOT to SVG
                const svgString = viz.renderSVGElement(code);
                container.appendChild(svgString);
                pre.replaceWith(container);
            } catch (e) {
                console.error('Graphviz render error:', e);
                container.innerHTML = `<div class="diagram-error">Error rendering diagram: ${e.message}</div>`;
                pre.replaceWith(container);
            }
        });
    } catch (e) {
        console.error('Viz.js initialization error:', e);
    }
}

/* =========================================
   Flashcards Carousel
   ========================================= */

function initializeFlashcards() {
    const flashcardBlocks = document.querySelectorAll('pre code.language-flashcards');
    if (flashcardBlocks.length === 0) return;

    flashcardBlocks.forEach((element, blockIndex) => {
        const code = element.textContent || '';
        const pre = element.parentElement;
        if (!pre || !pre.parentElement) return;

        // Parse flashcards from markdown
        // Format: Q: question text
        //         A: answer text
        //         ---  (separator between cards)
        const cards = parseFlashcards(code);
        if (cards.length === 0) return;

        // Create flashcard carousel container
        const container = document.createElement('div');
        container.className = 'flashcard-carousel';
        container.id = `flashcard-carousel-${blockIndex}`;

        // Create cards container
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'flashcard-cards';

        // Create individual cards
        cards.forEach((card, cardIndex) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'flashcard';
            cardEl.dataset.index = cardIndex;
            if (cardIndex === 0) cardEl.classList.add('active');

            const cardInner = document.createElement('div');
            cardInner.className = 'flashcard-inner';

            // Front (Question)
            const front = document.createElement('div');
            front.className = 'flashcard-front';
            front.innerHTML = `
                <div class="flashcard-label">Question</div>
                <div class="flashcard-content">${escapeHtml(card.question)}</div>
                <div class="flashcard-hint">Click to reveal answer</div>
            `;

            // Back (Answer)
            const back = document.createElement('div');
            back.className = 'flashcard-back';
            back.innerHTML = `
                <div class="flashcard-label">Answer</div>
                <div class="flashcard-content">${escapeHtml(card.answer)}</div>
                <div class="flashcard-hint">Click to see question</div>
            `;

            cardInner.appendChild(front);
            cardInner.appendChild(back);
            cardEl.appendChild(cardInner);

            // Flip on click
            cardEl.addEventListener('click', () => {
                cardEl.classList.toggle('flipped');
            });

            cardsContainer.appendChild(cardEl);
        });

        // Navigation controls - create buttons separately for inline placement
        const prevBtn = document.createElement('button');
        prevBtn.className = 'flashcard-btn flashcard-prev';
        prevBtn.setAttribute('aria-label', 'Previous card');
        prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';

        const nextBtn = document.createElement('button');
        nextBtn.className = 'flashcard-btn flashcard-next';
        nextBtn.setAttribute('aria-label', 'Next card');
        nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';

        const counter = document.createElement('span');
        counter.className = 'flashcard-counter';
        counter.textContent = `1 / ${cards.length}`;

        // Build layout: prev button, cards, next button (inline)
        container.appendChild(prevBtn);
        container.appendChild(cardsContainer);
        container.appendChild(nextBtn);
        cardsContainer.appendChild(counter);
        pre.replaceWith(container);

        // Navigation logic
        let currentIndex = 0;
        const cardEls = cardsContainer.querySelectorAll('.flashcard');

        function showCard(index) {
            cardEls.forEach((el, i) => {
                el.classList.remove('active', 'prev', 'next', 'hidden');
                el.classList.remove('flipped'); // Reset flip state
                if (i === index) {
                    el.classList.add('active');
                } else if (i === index - 1) {
                    el.classList.add('prev');
                } else if (i === index + 1) {
                    el.classList.add('next');
                } else {
                    el.classList.add('hidden');
                }
            });
            counter.textContent = `${index + 1} / ${cards.length}`;
        }

        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentIndex > 0) {
                currentIndex--;
                showCard(currentIndex);
            }
        });

        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentIndex < cards.length - 1) {
                currentIndex++;
                showCard(currentIndex);
            }
        });

        // Keyboard navigation
        container.tabIndex = 0;
        container.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' && currentIndex > 0) {
                currentIndex--;
                showCard(currentIndex);
            } else if (e.key === 'ArrowRight' && currentIndex < cards.length - 1) {
                currentIndex++;
                showCard(currentIndex);
            } else if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                cardEls[currentIndex].classList.toggle('flipped');
            }
        });
    });
}

/**
 * Parse flashcard markdown format
 * @param {string} content
 * @returns {Array<{question: string, answer: string}>}
 */
function parseFlashcards(content) {
    const cards = [];
    const cardBlocks = content.split(/\n---\n|\n---$|^---\n/);

    cardBlocks.forEach(block => {
        const trimmed = block.trim();
        if (!trimmed) return;

        // Match Q: and A: patterns
        const qMatch = trimmed.match(/^Q:\s*(.+?)(?=\nA:|$)/s);
        const aMatch = trimmed.match(/\nA:\s*(.+?)$/s);

        if (qMatch) {
            cards.push({
                question: qMatch[1].trim(),
                answer: aMatch ? aMatch[1].trim() : 'No answer provided'
            });
        }
    });

    return cards;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* =========================================
   GitHub Callouts
   ========================================= */

function processGitHubCallouts() {
    const postBody = document.querySelector('.post-body');
    if (!postBody) return;

    const blockquotes = postBody.querySelectorAll('blockquote');
    const useHugeicons = localStorage.getItem('materio_ota_hugeicons') === 'true';

    const calloutConfig = {
        'NOTE': {
            faIcon: 'fa-solid fa-circle-info',
            hugeIcon: 'hgi-stroke hgi-information-circle',
            class: 'callout-note',
            titleClass: 'callout-title-note',
            iconClass: 'callout-icon-note',
            label: 'Note'
        },
        'TIP': {
            faIcon: 'fa-solid fa-lightbulb',
            hugeIcon: 'hgi-stroke hgi-bulb',
            class: 'callout-tip',
            titleClass: 'callout-title-tip',
            iconClass: 'callout-icon-tip',
            label: 'Tip'
        },
        'IMPORTANT': {
            faIcon: 'fa-solid fa-circle-exclamation',
            hugeIcon: 'hgi-stroke hgi-alert-circle',
            class: 'callout-important',
            titleClass: 'callout-title-important',
            iconClass: 'callout-icon-important',
            label: 'Important'
        },
        'WARNING': {
            faIcon: 'fa-solid fa-triangle-exclamation',
            hugeIcon: 'hgi-stroke hgi-alert-02',
            class: 'callout-warning',
            titleClass: 'callout-title-warning',
            iconClass: 'callout-icon-warning',
            label: 'Warning'
        },
        'CAUTION': {
            faIcon: 'fa-solid fa-hand',
            hugeIcon: 'hgi-stroke hgi-stop-sign',
            class: 'callout-caution',
            titleClass: 'callout-title-caution',
            iconClass: 'callout-icon-caution',
            label: 'Caution'
        }
    };

    blockquotes.forEach(blockquote => {
        if (blockquote.closest('pre, code, .highlight')) return;
        if (blockquote.querySelector('code') && !blockquote.querySelector('p')) return;

        const firstP = blockquote.querySelector('p:first-child');
        if (!firstP) return;

        const text = firstP.innerHTML;
        const match = text.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);

        if (match) {
            const type = match[1].toUpperCase();
            // @ts-ignore
            const config = calloutConfig[type];

            if (config) {
                blockquote.classList.add(config.class);
                blockquote.setAttribute('data-callout', type.toLowerCase());

                let remainingText = text.replace(match[0], '').trim();
                remainingText = remainingText.replace(/^<br\s*\/?>\s*/i, '');

                const titleDiv = document.createElement('div');
                titleDiv.className = `callout-title ${config.titleClass}`;

                const iconEl = document.createElement('i');
                const iconClasses = useHugeicons ? config.hugeIcon : config.faIcon;
                iconEl.className = `${iconClasses} callout-icon ${config.iconClass}`;

                const labelSpan = document.createElement('span');
                labelSpan.textContent = config.label;

                titleDiv.appendChild(iconEl);
                titleDiv.appendChild(labelSpan);

                const contentDiv = document.createElement('div');
                contentDiv.className = 'callout-content';

                if (remainingText) {
                    firstP.innerHTML = remainingText;
                    contentDiv.appendChild(firstP.cloneNode(true));
                }

                const otherElements = Array.from(blockquote.children).slice(remainingText ? 1 : 0);
                otherElements.forEach(el => {
                    if (el !== firstP || !remainingText) {
                        contentDiv.appendChild(el.cloneNode(true));
                    }
                });

                blockquote.innerHTML = '';
                blockquote.appendChild(titleDiv);
                if (contentDiv.children.length > 0) {
                    blockquote.appendChild(contentDiv);
                }
            }
        }
    });
}

/* =========================================
   Attachments & Video
   ========================================= */

function processAttachmentTags() {
    const postBody = document.querySelector('.post-body');
    if (!postBody) return;

    const attachmentPattern = /\[attachment:([^\]]+):([^\]:]+)\]/g;
    let replacements = 0;

    /** @param {Node} node */
    function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.nodeValue || '';
            let match;
            let lastIndex = 0;
            const frag = document.createDocumentFragment();
            attachmentPattern.lastIndex = 0;
            let found = false;

            while ((match = attachmentPattern.exec(text)) !== null) {
                found = true;
                const [fullMatch, filePath, displayName] = match;
                const start = match.index;
                if (start > lastIndex) {
                    frag.appendChild(document.createTextNode(text.slice(lastIndex, start)));
                }
                const attachmentEl = createAttachmentElement(filePath.trim(), displayName.trim());
                frag.appendChild(attachmentEl);
                lastIndex = start + fullMatch.length;
                replacements++;
            }
            if (found) {
                if (lastIndex < text.length) {
                    frag.appendChild(document.createTextNode(text.slice(lastIndex)));
                }
                if (node.parentNode) node.parentNode.replaceChild(frag, node);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE && !['A', 'SCRIPT', 'STYLE'].includes(node.nodeName)) {
            const children = Array.from(node.childNodes);
            for (const child of children) {
                walk(child);
            }
        }
    }

    walk(postBody);

    if (replacements > 0) {
        setTimeout(initializeAttachmentCards, 100);
    }
}

/**
 * @param {string} filePath
 * @param {string} displayName
 */
function createAttachmentElement(filePath, displayName) {
    const container = document.createElement('div');
    const attachmentId = 'attachment-' + Math.random().toString(36).substr(2, 9);
    const fileExtension = (filePath.split('.').pop() || '').toLowerCase();

    container.className = 'attachment-card';
    container.setAttribute('data-file-path', filePath);
    container.setAttribute('data-attachment-id', attachmentId);

    const details = document.createElement('div');
    details.className = 'attachment-details';

    const title = document.createElement('div');
    title.className = 'attachment-title';
    title.textContent = displayName || (filePath.split('/').pop() || filePath);

    const meta = document.createElement('div');
    meta.className = 'attachment-meta';
    meta.innerHTML = `<span class="file-type">${fileExtension.toUpperCase()}</span> • <span class="file-size">Click to view</span>`;

    details.appendChild(title);
    details.appendChild(meta);

    const preview = document.createElement('div');
    preview.className = 'attachment-preview';
    const canvas = document.createElement('canvas');
    canvas.id = `canvas-${attachmentId}`;
    canvas.width = 100;
    canvas.height = 130;
    const img = document.createElement('img');
    img.id = `img-${attachmentId}`;
    img.style.display = 'none';
    preview.appendChild(canvas);
    preview.appendChild(img);

    container.appendChild(details);
    container.appendChild(preview);

    container.addEventListener('click', () => window.open(filePath, '_blank'));

    return container;
}

function initializeAttachmentCards() {
    document.querySelectorAll('.attachment-card').forEach(async (card) => {
        const filePath = card.getAttribute('data-file-path');
        const attachmentId = card.getAttribute('data-attachment-id');
        if (filePath && attachmentId) {
            await generateAttachmentPreview(filePath, attachmentId);
        }
    });
}

/**
 * @param {string} filePath
 * @param {string} attachmentId
 */
async function generateAttachmentPreview(filePath, attachmentId) {
    /** @type {HTMLCanvasElement | null} */
    // @ts-ignore
    const canvas = document.getElementById(`canvas-${attachmentId}`);
    /** @type {HTMLImageElement | null} */
    // @ts-ignore
    const img = document.getElementById(`img-${attachmentId}`);

    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fileExtension = (filePath.split('.').pop() || '').toLowerCase();

    try {
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension)) {
            generateImagePreview(filePath, canvas, img);
        } else if (fileExtension === 'pdf') {
            await generatePDFPreview(filePath, canvas);
        } else if (['doc', 'docx', 'txt', 'rtf'].includes(fileExtension)) {
            generateDocumentPreview(fileExtension, canvas, ctx);
        } else {
            generateGenericPreview(fileExtension, canvas, ctx);
        }
    } catch (error) {
        console.error('Error generating preview:', error);
        generateGenericPreview(fileExtension, canvas, ctx);
    }
}

/**
 * @param {string} filePath
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLImageElement} img
 */
function generateImagePreview(filePath, canvas, img) {
    img.src = filePath;
    img.onload = function () {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = 100;
        const height = 130;
        canvas.width = width;
        canvas.height = height;
        const naturalWidth = img.naturalWidth || img.width;
        const naturalHeight = img.naturalHeight || img.height;
        const scale = Math.min(width / naturalWidth, height / naturalHeight);
        const drawWidth = naturalWidth * scale;
        const drawHeight = naturalHeight * scale;
        const x = (width - drawWidth) / 2;
        const y = (height - drawHeight) / 2;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, x, y, drawWidth, drawHeight);
    };
    img.onerror = () => generateGenericPreview('IMG', canvas, canvas.getContext('2d'));
}

/**
 * @param {string} filePath
 * @param {HTMLCanvasElement} canvas
 */
async function generatePDFPreview(filePath, canvas) {
    // @ts-ignore
    if (typeof pdfjsLib === 'undefined') {
        generateGenericPreview('PDF', canvas, canvas.getContext('2d'));
        return;
    }
    try {
        // @ts-ignore
        const pdf = await pdfjsLib.getDocument(filePath).promise;
        const page = await pdf.getPage(1);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = 100;
        const height = 130;
        canvas.width = width;
        canvas.height = height;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);

        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(width / viewport.width, height / viewport.height);
        const scaledViewport = page.getViewport({ scale });
        const scratchCanvas = document.createElement('canvas');
        scratchCanvas.width = Math.ceil(scaledViewport.width);
        scratchCanvas.height = Math.ceil(scaledViewport.height);
        const scratchCtx = scratchCanvas.getContext('2d');
        if (!scratchCtx) return;

        await page.render({ canvasContext: scratchCtx, viewport: scaledViewport }).promise;
        const x = (width - scratchCanvas.width) / 2;
        const y = (height - scratchCanvas.height) / 2;
        ctx.drawImage(scratchCanvas, x, y);
    } catch (error) {
        console.error('PDF preview error:', error);
        generateGenericPreview('PDF', canvas, canvas.getContext('2d'));
    }
}

/**
 * @param {string} fileExtension
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D | null} ctx
 */
function generateDocumentPreview(fileExtension, canvas, ctx) {
    if (!ctx) return;
    canvas.width = 100;
    canvas.height = 130;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 100, 130);
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 1;
    for (let i = 20; i < 120; i += 8) {
        ctx.beginPath();
        ctx.moveTo(10, i);
        ctx.lineTo(90, i);
        ctx.stroke();
    }
    ctx.fillStyle = "#4285f4";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(fileExtension.toUpperCase(), 50, 110);
    ctx.fillStyle = "#666";
    ctx.font = "16px Arial";
    ctx.fillText("📄", 50, 25);
}

/**
 * @param {string} fileExtension
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D | null} ctx
 */
function generateGenericPreview(fileExtension, canvas, ctx) {
    if (!ctx) return;
    canvas.width = 100; // Force sizes
    canvas.height = 130;
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, 0, 100, 130);
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 100, 130);
    ctx.fillStyle = "#666";
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.fillText("📎", 50, 45);
    ctx.fillStyle = "#333";
    ctx.font = "bold 14px Arial";
    ctx.fillText(fileExtension.toUpperCase(), 50, 70);
    ctx.fillStyle = "#888";
    ctx.font = "10px Arial";
    ctx.fillText("File", 50, 90);
}

/**
 * @param {string} params
 */
function createVideoElement(params) {
    const isCover = params.trim().endsWith(':cover');
    const videoPath = isCover ? params.trim().slice(0, -6).trim() : params.trim();

    const videoId = 'video-' + Math.random().toString(36).substr(2, 9);
    const coverClass = isCover ? 'video-cover' : 'video-embed';

    const container = document.createElement('div');
    container.className = coverClass;

    const video = document.createElement('video');
    video.id = videoId;
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = videoPath;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('muted', '');
    video.defaultMuted = true;

    const controls = document.createElement('div');
    controls.className = 'video-controls playing';
    controls.onclick = () => toggleVideo(videoId);
    controls.innerHTML = '<i class="fa-solid fa-pause"></i>';

    container.appendChild(video);
    container.appendChild(controls);

    // Auto-play logic with retries
    video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.log("Autoplay prevented", e));
    });

    return container;
}

function processVideoTags() {
    const postBody = document.querySelector('.post-body');
    if (!postBody) return;

    const videoTagRegex = /\[video:([^\]]+)\]/g;

    /** @param {Node} node */
    function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.nodeValue || '';
            let match;
            let lastIndex = 0;
            const frag = document.createDocumentFragment();
            videoTagRegex.lastIndex = 0;
            let found = false;

            while ((match = videoTagRegex.exec(text)) !== null) {
                found = true;
                const [fullMatch, params] = match;
                const start = match.index;
                if (start > lastIndex) {
                    frag.appendChild(document.createTextNode(text.slice(lastIndex, start)));
                }
                const videoEl = createVideoElement(params);
                frag.appendChild(videoEl);
                lastIndex = start + fullMatch.length;
            }
            if (found) {
                if (lastIndex < text.length) {
                    frag.appendChild(document.createTextNode(text.slice(lastIndex)));
                }
                if (node.parentNode) node.parentNode.replaceChild(frag, node);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE && !['A', 'SCRIPT', 'STYLE'].includes(node.nodeName)) {
            const children = Array.from(node.childNodes);
            for (const child of children) {
                walk(child);
            }
        }
    }

    walk(postBody);
}

/**
 * @param {string} videoId
 */
function toggleVideo(videoId) {
    /** @type {HTMLVideoElement | null} */
    // @ts-ignore
    const video = document.getElementById(videoId);
    if (!video) return;
    const controls = video.parentElement?.querySelector('.video-controls');

    let icon = null;
    if (controls) {
        icon = controls.querySelector('i');
    }

    if (video.paused) {
        video.play();
        if (icon) icon.className = 'fa-solid fa-pause';
        if (controls) {
            controls.classList.remove('paused');
            controls.classList.add('playing');
        }
    } else {
        video.pause();
        if (icon) icon.className = 'fa-solid fa-play';
        if (controls) {
            controls.classList.add('paused');
            controls.classList.remove('playing');
        }
    }
}

/* =========================================
   Scroll To Top & Print
   ========================================= */



function initializePrintEnhancements() {
    if (window.__printEnhancementsInitialized) return;
    window.__printEnhancementsInitialized = true;
    window.addEventListener('beforeprint', generatePrintElements);
    window.addEventListener('afterprint', cleanupPrintElements);
}

function generatePrintElements() {
    if (document.querySelector('.print-page-header')) return;

    const postContainer = document.querySelector('.post-container');
    if (!postContainer) return;

    const printContainer = document.createElement('div');
    printContainer.className = 'print-only-element print-page-header';
    printContainer.style.cssText = `
    display: none; width: 100%; height: 170px; margin-bottom: 10px; position: relative;
    border-bottom: 1px solid #ddd; padding-top: 0px; padding-bottom: 8px; overflow: visible;
  `;

    const logoDiv = document.createElement('div');
    logoDiv.style.cssText = 'position: absolute; left: 0; top: 50%; transform: translateY(-50%);';
    logoDiv.innerHTML = '<img src="/assets/printables/header.svg" alt="Materio" style="height: 32px; width: auto;">';

    const qrSection = document.createElement('div');
    qrSection.style.cssText = 'position: absolute; right: 0; top: 8px; text-align: center; display: flex; flex-direction: column; align-items: center;';

    const qrTitle = document.createElement('div');
    qrTitle.style.cssText = 'font-family: var(--font-serif, "Tiempos Text VF", serif); font-size: 9px; color: #666; margin: 0 0 6px 0; z-index: 2;';
    qrTitle.textContent = 'Scan to read online';

    const qrContainer = document.createElement('div');
    qrContainer.style.cssText = 'width: 120px; height: 120px; margin-top: 0; z-index: 1;';

    const hiddenQR = document.getElementById('hidden-qr-code');
    const qrSource = hiddenQR ? hiddenQR.querySelector('svg, canvas, img') : null;

    if (qrSource) {
        qrContainer.appendChild(qrSource.cloneNode(true));
    } else {
        // Fallback: generate QR using qrserver.com API if hidden QR isn't ready
        const currentUrl = encodeURIComponent(window.location.href);
        const qrImg = document.createElement('img');
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${currentUrl}&format=png`;
        qrImg.style.cssText = 'width: 120px; height: 120px; display: block;';
        qrImg.alt = 'QR Code';
        qrContainer.appendChild(qrImg);
    }

    qrSection.appendChild(qrTitle);
    qrSection.appendChild(qrContainer);

    printContainer.appendChild(logoDiv);
    printContainer.appendChild(qrSection);
    postContainer.insertBefore(printContainer, postContainer.firstChild);

    if (!document.getElementById('print-element-style')) {
        const style = document.createElement('style');
        style.id = 'print-element-style';
        style.textContent = `
      @media print {
        .print-page-header { display: block !important; }
        .print-only-element { display: block !important; }
        @page :first { margin-top: 0.15in; }
        @page { margin-top: 0.75in; }
      }
      @media screen {
        .print-only-element { display: none !important; }
      }
    `;
        document.head.appendChild(style);
    }
}

function cleanupPrintElements() {
    document.querySelectorAll('.print-only-element').forEach(el => el.remove());
    const style = document.getElementById('print-element-style');
    if (style) style.remove();
}

function initializeSecureMode() {
    if (window.__secureModeInitialized) return;
    window.__secureModeInitialized = true;

    document.addEventListener('keydown', function (e) {
        const key = e.key.toLowerCase();
        const isBlocked = key === 'f12' || (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(key)) || (e.ctrlKey && key === 'u');
        if (isBlocked) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);
    
    // Block native context menu
    document.addEventListener('contextmenu', function (e) {
        /** @type {HTMLElement} */
        // @ts-ignore
        const target = e.target;
        if (!target) return;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            return;
        }
        e.preventDefault();
    });
    
    // Show context menu when text is selected (on mouseup)
    document.addEventListener('mouseup', function (e) {
        // Small delay to let the browser finalize the selection
        setTimeout(() => {
            const selection = window.getSelection();
            const selectedText = selection ? selection.toString().trim() : '';
            
            if (selectedText && selection && selection.rangeCount > 0) {
                // Position near the end of the selection
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                const x = rect.left + (rect.width / 2);
                const y = rect.top - 8; // just above the selection
                showCustomContextMenu(x, y);
            } else {
                hideCustomContextMenu();
            }
        }, 10);
    });
    
    // Hide custom context menu on scroll or click outside
    document.addEventListener('mousedown', function (e) {
        const menu = document.getElementById('custom-context-menu');
        if (menu && !menu.contains(/** @type {Node} */ (e.target))) {
            hideCustomContextMenu();
        }
    });
    document.addEventListener('scroll', hideCustomContextMenu);
}

/**
 * Show custom context menu with Copy and Ask options
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
function showCustomContextMenu(x, y) {
    // Get selected text
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';
    
    // Remove existing context menu
    const existing = document.getElementById('custom-context-menu');
    if (existing) existing.remove();
    
    // Create context menu container
    const menu = document.createElement('div');
    menu.id = 'custom-context-menu';
    menu.style.cssText = `
        position: fixed;
        top: ${y}px;
        left: ${x}px;
        background: var(--card-bg, #f9f9f9);
        border: 1px solid var(--border, #ddd);
        border-radius: 16px;
        corner-shape: squircle;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 4px;
        gap: 4px;
        overflow: hidden;
    `;
    
    const copySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const sparkleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path></svg>`;

    // Add Copy option if text is selected
    if (selectedText) {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'context-menu-item';
        copyBtn.innerHTML = copySvg;
        copyBtn.title = 'Copy';
        copyBtn.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border: none;
            border-radius: 12px;
            background: transparent;
            cursor: pointer;
            color: var(--text, #333);
        `;
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(selectedText).then(() => {
                hideCustomContextMenu();
            }).catch(err => {
                console.error('Copy failed:', err);
            });
        };
        menu.appendChild(copyBtn);
    }
    
    // Check if user has ask privileges (check if AISummary component is available with canAsk=true)
    const hasAskPrivileges = checkAskPrivileges();
    
    // Add Ask option if text is selected and user has privileges
    if (selectedText && hasAskPrivileges) {
        const askBtn = document.createElement('button');
        askBtn.className = 'context-menu-item';
        askBtn.innerHTML = sparkleSvg;
        askBtn.title = 'Ask AI';
        askBtn.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border: none;
            border-radius: 12px;
            background: transparent;
            cursor: pointer;
            color: var(--text, #333);
        `;
        askBtn.onclick = () => {
            hideCustomContextMenu();
            sendSelectedToAI(selectedText);
        };
        menu.appendChild(askBtn);
    }
    
    // If no options are available, don't show menu
    if (menu.children.length === 0) {
        return;
    }
    
    // Append to body
    document.body.appendChild(menu);
    
    // Adjust position — center horizontally and place above selection
    setTimeout(() => {
        const rect = menu.getBoundingClientRect();
        // Center the menu on x
        let adjustedX = x - (rect.width / 2);
        let adjustedY = y - rect.height;
        
        // Keep within viewport
        if (adjustedX < 8) adjustedX = 8;
        if (adjustedX + rect.width > window.innerWidth - 8) adjustedX = window.innerWidth - rect.width - 8;
        if (adjustedY < 8) adjustedY = y + 30; // flip below if no room above
        
        menu.style.left = adjustedX + 'px';
        menu.style.top = adjustedY + 'px';
    }, 0);
}

/**
 * Hide custom context menu
 */
function hideCustomContextMenu() {
    const menu = document.getElementById('custom-context-menu');
    if (menu) menu.remove();
}

/**
 * Check if user has ask privileges by checking if AISummary component is available
 * @returns {boolean}
 */
function checkAskPrivileges() {
    // Check if there's an AI summary component visible
    const aiSummary = document.querySelector('[data-ai-summary-available]');
    if (aiSummary) {
        const canAsk = aiSummary.getAttribute('data-can-ask');
        return canAsk !== 'false';
    }
    // Fallback: check if we have localStorage flag for permissions
    const userHasPrivileges = localStorage.getItem('has_ask_privileges') === 'true';
    return userHasPrivileges;
}

/**
 * Send selected text to AI summarizer's ask chat
 * @param {string} selectedText
 */
function sendSelectedToAI(selectedText) {
    // Dispatch custom event that AISummary component can listen to
    const event = new CustomEvent('ask-ai-selection', {
        detail: { text: selectedText }
    });
    document.dispatchEvent(event);
}

/**
 * Show temporary feedback message
 * @param {string} message
 */
function showContextMenuFeedback(message) {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #ff8200;
        color: white;
        padding: 12px 16px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(255, 130, 0, 0.3);
        z-index: 10001;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        animation: slideIn 0.3s ease-out;
    `;
    feedback.innerHTML = `<i class="fa-solid fa-check"></i>${message}`;
    document.body.appendChild(feedback);
    
    setTimeout(() => {
        feedback.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => feedback.remove(), 300);
    }, 2000);
}

// Add animations (only in browser, not during SSR)
if (typeof document !== 'undefined' && !document.getElementById('context-menu-styles')) {
    const style = document.createElement('style');
    style.id = 'context-menu-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        #custom-context-menu {
        }
        
        .context-menu-item i {
        }
        
        body.dark #custom-context-menu {
            background: var(--card-bg, #1e1e1e);
            border-color: var(--border, #333);
        }
        
        body.dark .context-menu-item {
            color: var(--text, #eee);
        }
    `;
    document.head.appendChild(style);
}



/* =========================================
   Interactive MCQ System
   ========================================= */
function initializeMCQSystem() {
    const postBody = document.querySelector('.post-body');
    if (!postBody) return;

    // Use .post-content-visible to avoid querying duplicate cards in Svelte's hidden .summary-capture
    const visibleContent = postBody.querySelector('.post-content-visible') || postBody;

    const cards = visibleContent.querySelectorAll('.mcq-card');
    if (cards.length === 0) return;

    // 1. Setup global state or scoreboard
    let scorecardContainer = visibleContent.querySelector('.mcq-scorecard-container');
    if (!scorecardContainer) {
        scorecardContainer = document.createElement('div');
        scorecardContainer.className = 'mcq-scorecard-container';
        visibleContent.appendChild(scorecardContainer);
    }

    const N = cards.length;
    const strokeWidth = 10;
    const radius = 80;
    const centerX = 100;
    const centerY = 95;

    // Helper functions for SVG arc drawing
    /**
     * @param {number} cx
     * @param {number} cy
     * @param {number} r
     * @param {number} angleInDegrees
     */
    function polarToCartesian(cx, cy, r, angleInDegrees) {
        const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
        return {
            x: cx + r * Math.cos(angleInRadians),
            y: cy - r * Math.sin(angleInRadians)
        };
    }

    /**
     * @param {number} cx
     * @param {number} cy
     * @param {number} r
     * @param {number} startAngle
     * @param {number} endAngle
     */
    function describeArc(cx, cy, r, startAngle, endAngle) {
        const start = polarToCartesian(cx, cy, r, startAngle);
        const end = polarToCartesian(cx, cy, r, endAngle);
        const largeArcFlag = startAngle - endAngle <= 180 ? "0" : "1";
        return [
            "M", start.x, start.y,
            "A", r, r, 0, largeArcFlag, 1, end.x, end.y
        ].join(" ");
    }

    // Determine spacing and generate SVG paths
    const gap = N === 1 ? 0 : Math.max(2, Math.min(10, 180 / (2 * N)));
    const totalGapAngle = gap * (N - 1);
    const totalSegmentAngle = 180 - totalGapAngle;
    const segSpan = totalSegmentAngle / N;

    let pathsHtml = '';
    for (let i = 0; i < N; i++) {
        const startAngle = 180 - i * (segSpan + gap);
        const endAngle = startAngle - segSpan;
        const d = describeArc(centerX, centerY, radius, startAngle, endAngle);
        pathsHtml += `<path d="${d}" fill="none" stroke-width="${strokeWidth}" stroke-linecap="round" class="mcq-gauge-segment" data-index="${i}" />`;
    }

    // Set SVG & scoreboard inner HTML
    scorecardContainer.innerHTML = `
        <div class="mcq-scorecard-title">Quiz Progress</div>
        <div class="mcq-gauge-wrapper">
            <svg width="200" height="110" viewBox="0 0 200 110">
                ${pathsHtml}
            </svg>
            <div class="mcq-score-display">
                <div class="score-num-wrapper">
                    <span class="score-num">0</span>
                    <span class="score-total">/${N}</span>
                </div>
                <div class="score-label">Score</div>
            </div>
        </div>
        <button class="mcq-take-again-btn">
            <i class="fa-solid fa-play"></i> Take Quiz
        </button>
    `;

    // References to updated DOM elements in the scorecard
    const segments = scorecardContainer.querySelectorAll('.mcq-gauge-segment');
    const scoreNum = scorecardContainer.querySelector('.score-num');
    const takeAgainBtn = scorecardContainer.querySelector('.mcq-take-again-btn');

    // Function to update scorecard status
    function updateScorecard() {
        let correctCount = 0;
        let answeredCount = 0;

        cards.forEach((card, idx) => {
            const isAnswered = card.classList.contains('answered');
            if (isAnswered) {
                answeredCount++;
                const isCorrect = card.hasAttribute('data-all-correct')
                    ? card.getAttribute('data-all-correct') === 'true'
                    : !card.querySelector('.mcq-option.incorrect');
                if (isCorrect) {
                    correctCount++;
                    segments[idx].setAttribute('class', 'mcq-gauge-segment correct');
                } else {
                    segments[idx].setAttribute('class', 'mcq-gauge-segment incorrect');
                }
            } else {
                segments[idx].setAttribute('class', 'mcq-gauge-segment');
            }
        });

        if (scoreNum) scoreNum.textContent = String(correctCount);

        // Hide gauge and score wrapper if no questions are answered yet (Scorecard initially clean)
        const gaugeWrapper = scorecardContainer.querySelector('.mcq-gauge-wrapper');
        if (gaugeWrapper) {
            gaugeWrapper.style.display = answeredCount > 0 ? '' : 'none';
        }

        // Dynamic take again button text
        if (takeAgainBtn) {
            if (answeredCount > 0) {
                takeAgainBtn.innerHTML = `<i class="fa-solid fa-rotate-left"></i> Take Again`;
            } else {
                takeAgainBtn.innerHTML = `<i class="fa-solid fa-play"></i> Take Quiz`;
            }
        }
    }

    // Initial update
    updateScorecard();

    // Listen for events bubbled up from cards
    visibleContent.addEventListener('mcq-answer', updateScorecard);
    visibleContent.addEventListener('mcq-reset', updateScorecard);

    // Setup Slideshow Quiz Mode logic
    let slideshowContainer = visibleContent.querySelector('.mcq-slideshow-container');
    if (!slideshowContainer) {
        slideshowContainer = document.createElement('div');
        slideshowContainer.className = 'mcq-slideshow-container';
        slideshowContainer.style.display = 'none';
        visibleContent.insertBefore(slideshowContainer, scorecardContainer);
    }

    let currentSlideIndex = 0;

    function exitQuizMode() {
        if (slideshowContainer) slideshowContainer.style.display = 'none';
        if (scorecardContainer) scorecardContainer.style.display = '';
        updateScorecard();
        
        // Scroll back to scorecard
        if (scorecardContainer) {
            scorecardContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    /**
     * @param {number} index
     */
    function showSlide(index) {
        currentSlideIndex = index;
        if (!slideshowContainer) return;
        const progress = slideshowContainer.querySelector('.mcq-slideshow-progress');
        const prevBtn = slideshowContainer.querySelector('.prev-btn');
        const nextBtn = slideshowContainer.querySelector('.next-btn');
        const body = slideshowContainer.querySelector('.mcq-slideshow-body');

        // Update progress text
        if (progress) progress.textContent = `Question ${currentSlideIndex + 1} of ${N}`;

        // Move a CLONED copy of the card to the slideshow body to keep in-post MCQs fully visible and intact!
        if (body) {
            body.innerHTML = '';
            // Clone the original card to keep it visible in post body
            const cardClone = cards[currentSlideIndex].cloneNode(true);
            cardClone.style.display = '';
            
            // Remove the reset button inside the slideshow card to keep the modal focused and clean
            const cloneReset = cardClone.querySelector('.mcq-reset-btn');
            if (cloneReset) cloneReset.remove();

            body.appendChild(cardClone);
        }

        // Update nav button states
        if (prevBtn) {
            /** @type {HTMLButtonElement} */ (prevBtn).disabled = currentSlideIndex === 0;
        }
        if (nextBtn) {
            if (currentSlideIndex === N - 1) {
                nextBtn.innerHTML = `Finish <i class="fa-solid fa-check"></i>`;
            } else {
                nextBtn.innerHTML = `Next <i class="fa-solid fa-chevron-right"></i>`;
            }
        }
    }

    // Hook up takeAgainBtn
    if (takeAgainBtn) {
        takeAgainBtn.addEventListener('click', () => {
            // Reset all cards (re-evaluating answers fresh for the quiz)
            cards.forEach(card => {
                const resetBtn = card.querySelector('.mcq-reset-btn');
                if (resetBtn) {
                    /** @type {HTMLElement} */ (resetBtn).click();
                }
            });

            // Keep in-post MCQs visible (no display = 'none'), just hide scorecard
            if (scorecardContainer) scorecardContainer.style.display = 'none';

            // Setup/initialize slideshow DOM
            if (slideshowContainer) {
                slideshowContainer.innerHTML = `
                    <div class="mcq-slideshow-header">
                        <span class="mcq-slideshow-progress">Question 1 of ${N}</span>
                        <button class="mcq-slideshow-close-btn" title="Exit Quiz"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="mcq-slideshow-body"></div>
                    <div class="mcq-slideshow-footer">
                        <button class="mcq-slideshow-nav-btn prev-btn"><i class="fa-solid fa-chevron-left"></i> Previous</button>
                        <button class="mcq-slideshow-nav-btn next-btn">Next <i class="fa-solid fa-chevron-right"></i></button>
                    </div>
                `;
                slideshowContainer.style.display = '';

                // Add event listeners inside slideshow
                const closeBtn = slideshowContainer.querySelector('.mcq-slideshow-close-btn');
                const prevBtn = slideshowContainer.querySelector('.prev-btn');
                const nextBtn = slideshowContainer.querySelector('.next-btn');
                const body = slideshowContainer.querySelector('.mcq-slideshow-body');

                if (closeBtn) closeBtn.addEventListener('click', exitQuizMode);
                if (prevBtn) {
                    prevBtn.addEventListener('click', () => {
                        if (currentSlideIndex > 0) {
                            showSlide(currentSlideIndex - 1);
                        }
                    });
                }
                if (nextBtn) {
                    nextBtn.addEventListener('click', () => {
                        if (currentSlideIndex < N - 1) {
                            showSlide(currentSlideIndex + 1);
                        } else {
                            exitQuizMode();
                        }
                    });
                }

                // Add synchronization listener on slideshow body
                // Clicking option inside the clone triggers a click on the original inline MCQ card button
                if (body) {
                    body.addEventListener('click', (e) => {
                        // Cast EventTarget to HTMLElement
                        const target = /** @type {HTMLElement} */ (e.target);
                        
                        const btn = target.closest('.mcq-option');
                        if (btn) {
                            const optionIndex = parseInt(btn.getAttribute('data-index') || '0', 10);
                            const originalCard = cards[currentSlideIndex];
                            const originalBtns = originalCard.querySelectorAll('.mcq-option');
                            if (originalBtns[optionIndex]) {
                                // Sync selection click back to original card if it is not already answered
                                if (!originalCard.classList.contains('answered')) {
                                    /** @type {HTMLElement} */ (originalBtns[optionIndex]).click();
                                }
                            }
                        }
                    });
                }

                // Show the first slide and scroll focus
                showSlide(0);
                slideshowContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }

    // Generate Print Answer Key
    let printAnswerKey = visibleContent.querySelector('.print-answer-key');
    if (!printAnswerKey) {
        printAnswerKey = document.createElement('div');
        printAnswerKey.className = 'print-answer-key';
        
        const title = document.createElement('h2');
        title.textContent = 'Answer Key';
        printAnswerKey.appendChild(title);
        
        const answerList = document.createElement('ul');
        
        cards.forEach((card, idx) => {
            const correctIdx = parseInt(card.getAttribute('data-correct-index') || '0', 10);
            const letters = ['a', 'b', 'c', 'd', 'e'];
            const correctLetter = letters[correctIdx] || '?';
            
            const li = document.createElement('li');
            li.innerHTML = `<strong>Q${idx + 1}.</strong> ${correctLetter}.)`;
            answerList.appendChild(li);
        });
        
        printAnswerKey.appendChild(answerList);
        visibleContent.appendChild(printAnswerKey);
    }
}

export function initializeArtifacts() {
    if (typeof window === 'undefined') return;

    // Process and move cover artifacts if present
    const coverSource = document.querySelector('[data-cover-artifact-source] .artifact-container');
    const coverTarget = document.getElementById('post-cover-target');
    if (coverTarget) {
        if (coverSource) {
            coverTarget.innerHTML = '';
            coverTarget.appendChild(coverSource);
            coverTarget.style.display = 'block';
            
            // Set initial scroll progress if not inside editor preview
            if (!coverTarget.closest('.preview-box')) {
                const scrollY = window.scrollY || document.documentElement.scrollTop;
                const progress = Math.min(scrollY / 250, 1);
                coverTarget.style.setProperty('--progress', String(progress));
            }
        } else {
            coverTarget.innerHTML = '';
            coverTarget.style.display = 'none';
        }
    }

    document.querySelectorAll('.artifact-container').forEach(container => {
        if (container.dataset.initialized) return;
        container.dataset.initialized = 'true';

        const template = container.querySelector('template');
        const innerNode = template || container.querySelector('div');
        if (!innerNode) return;

        const rawHtml = innerNode.innerHTML;

        const iframe = document.createElement('iframe');
        iframe.className = 'artifact-iframe';
        iframe.style.width = '100%';
        const isCover = container.closest('#post-cover-target');
        iframe.style.height = isCover ? '450px' : '150px';
        iframe.style.border = 'none';
        iframe.style.background = 'transparent';
        iframe.style.overflow = 'hidden';
        iframe.style.display = 'block';
        iframe.setAttribute('scrolling', 'no');
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-downloads allow-forms allow-modals allow-popups');
        
        const doctype = '<!DOCTYPE html>\n';
        let srcdocHtml = rawHtml.trim().toLowerCase().startsWith('<!doctype html') ? rawHtml : doctype + rawHtml;
        
        // Auto-inject local D3, TopoJSON, and Map Data if used, avoiding external network requests
        let injectedScripts = `
        <script>
        (function() {
            try {
                var desc = Object.getOwnPropertyDescriptor(Document.prototype, 'currentScript') || 
                           Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'currentScript');
                var originalGetter = desc && desc.get;
                Object.defineProperty(document, 'currentScript', {
                    get: function() {
                        if (originalGetter) {
                            var res = originalGetter.call(document);
                            if (res) return res;
                        }
                        var scripts = document.getElementsByTagName('script');
                        return scripts[scripts.length - 1] || null;
                    },
                    configurable: true
                });
            } catch (e) {
                console.warn('Failed to define document.currentScript polyfill:', e);
            }
        })();
        </script>
        `;
        if (srcdocHtml.includes('d3.') && !srcdocHtml.includes('d3.v7.min.js') && !srcdocHtml.includes('npm/d3')) {
            injectedScripts += '<script src="/assets/lib/d3.v7.min.js"></script>\n';
        }
        if (srcdocHtml.includes('topojson') && !srcdocHtml.includes('topojson-client')) {
            injectedScripts += '<script src="/assets/lib/topojson-client.min.js"></script>\n';
        }
        if ((srcdocHtml.includes('d3.geo') || srcdocHtml.includes('topojson')) && !srcdocHtml.includes('world-110m.js')) {
            injectedScripts += '<script src="/assets/lib/world-110m.js"></script>\n';
        }
        
        // Add import map for modern ES modules
        injectedScripts += `
        <script type="importmap">
        {
            "imports": {
                "d3": "/assets/lib/d3.esm.js",
                "topojson-client": "/assets/lib/topojson-client.esm.js"
            }
        }
        </script>
        `;
        
        if (injectedScripts) {
            srcdocHtml = srcdocHtml.replace(/<!doctype html>/i, '$&\n' + injectedScripts);
        }

        iframe.srcdoc = srcdocHtml;

        iframe.addEventListener('load', () => {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                if (doc && doc.body) {
                    // Copy all stylesheet and font preconnect/link tags from the parent to render matching fonts/elements
                    document.querySelectorAll('link[rel="stylesheet"], link[rel="preconnect"], style').forEach(el => {
                        doc.head.appendChild(el.cloneNode(true));
                    });

                    // Set body class to match parent body for theme-specific CSS selectors
                    doc.body.className = document.body.className + " artifact-viewport";

                    // Apply default styles to the iframe's body to match layout/font/theme while keeping background transparent
                    const style = doc.createElement('style');
                    const isCoverIframe = iframe.closest('#post-cover-target');
                    style.textContent = `
                        html, body {
                            margin: 0 !important;
                            padding: 0 !important;
                            background: transparent !important;
                            overflow: hidden !important;
                            ${isCoverIframe ? '' : 'height: auto !important; min-height: 0 !important;'}
                            font-family: inherit;
                            color: var(--text, inherit) !important;
                        }
                        body {
                            display: flow-root !important; /* Contains margins to accurately measure height */
                        }
                    `;
                    doc.head.appendChild(style);

                    // Set up dynamic resize observer
                    const updateHeight = () => {
                        const height = Math.max(
                            doc.body.scrollHeight || 0,
                            doc.body.offsetHeight || 0
                        );
                        if (height > 0) {
                            iframe.style.height = `${height}px`;
                        }
                    };

                    const observer = new ResizeObserver(updateHeight);
                    observer.observe(doc.body);
                    // @ts-ignore
                    iframe._resizeObserver = observer;

                    // Sync theme changes dynamically
                    const themeListener = (e) => {
                        if (!iframe.isConnected) {
                            window.removeEventListener('themeChanged', themeListener);
                            return;
                        }
                        try {
                            // Sync parent body classes (handles fonts and themes)
                            doc.body.className = document.body.className + " artifact-viewport";
                        } catch (err) {
                            console.error("Failed to update iframe theme:", err);
                        }
                    };
                    window.addEventListener('themeChanged', themeListener);

                    // Initial height calculation
                    updateHeight();
                }
            } catch (e) {
                console.error("Failed to setup iframe resources or resize observer:", e);
            }
        });

        innerNode.replaceWith(iframe);
    });
}
