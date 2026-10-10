/* src/lib/utils/toc.js */
// @ts-nocheck

  function isVisible(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function getTargetById(id) {
    if (!id) return null;
    let target = document.getElementById(id);
    // If found but hidden (likely in .summary-capture), try to find a visible duplicate
    if (target && !isVisible(target)) {
      try {
        const escaped = CSS.escape(id);
        const all = document.querySelectorAll('#' + escaped);
        for (let i = 0; i < all.length; i++) {
          if (isVisible(all[i])) return all[i];
        }
      } catch (e) { }
    }
    return target;
  }

  function fixDuplicateIds() {
    // Remove IDs from the hidden summary capture div to prevent conflicts
    const hidden = document.querySelector('.summary-capture');
    if (hidden) {
      const elements = hidden.querySelectorAll('[id]');
      elements.forEach(el => el.removeAttribute('id'));
    }
  }

  function slugify(text) {
    return text.toString().toLowerCase().trim()
      .replace(/[\u2018\u2019\u201C\u201D]/g, '')
      .replace(/[^a-z0-9\s\-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/\-+/g, '-');
  }

  function buildTOCFallback() {
    const aside = document.querySelector('.post-toc');
    if (!aside) return;

    // If server-side plugin already produced content, do nothing
    if (aside.querySelector('.toc') && aside.querySelector('.toc').children.length > 0) return;

    // Prefer visible content container to avoid picking up hidden summary headings
    const postBody = document.querySelector('.post-content-visible') || document.querySelector('.post-body');
    if (!postBody) return;

    // Collect headings (skip h1 which is usually the title)
    // include only h1, h2, h3 as requested (#, ##, ###)
    const headings = postBody.querySelectorAll('h1, h2, h3');
    if (!headings || headings.length === 0) return;

    // Create nav.toc
    const nav = document.createElement('nav');
    nav.className = 'toc';

    const title = document.createElement('h2');
    title.textContent = 'On this page';
    nav.appendChild(title);

    const ul = document.createElement('ul');
    nav.appendChild(ul);

    headings.forEach(h => {
      let id = h.id;
      if (!id) {
        id = slugify(h.textContent || h.innerText || '');
        // ensure unique
        let uniq = id;
        let i = 1;
        while (document.getElementById(uniq)) {
          uniq = id + '-' + i++;
        }
        id = uniq;
        h.id = id;
      }

      const li = document.createElement('li');
      li.className = 'toc-level-' + (parseInt(h.tagName.replace('H', ''), 10));

      const a = document.createElement('a');
      a.href = '#' + id;

      // Clone header to remove anchor link without affecting DOM
      const clone = h.cloneNode(true);
      const anchor = clone.querySelector('.heading-anchor');
      if (anchor) {
        anchor.remove();
      }

      // Use innerHTML so any math delimiters or inline HTML remains intact for KaTeX auto-render
      a.innerHTML = clone.innerHTML || (clone.textContent || clone.innerText);
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        const target = getTargetById(id);
        if (target) {
          const offset = 80; // adjust for sticky header
          const top = target.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      });

      li.appendChild(a);
      ul.appendChild(li);
    });

    aside.appendChild(nav);

    // If KaTeX auto-render isn't available, remove raw latex markers from links to avoid ugly $$...$$ showing
    if (typeof window.renderMathInElement !== 'function') {
      const mathStripRegex = /(\$\$[\s\S]*?\$\$|\$[^\$]*\$)/g;
      const anchors = aside.querySelectorAll('a');
      anchors.forEach(a => {
        a.innerHTML = a.innerHTML.replace(mathStripRegex, '').trim();
      });
    }
  }

  function isDesktopViewport() {
    return window.matchMedia('(min-width: 981px)').matches;
  }

  function closeTOCStates() {
    document.body.classList.remove('toc-open');
    document.body.classList.remove('toc-hover-open');
    document.body.classList.remove('toc-sheet-open');
    document.body.classList.remove('toc-sheet-dragging');

    const sidebar = document.getElementById('site-toc-sidebar');
    const overlay = document.getElementById('site-toc-overlay');
    if (sidebar) sidebar.setAttribute('aria-hidden', 'true');
    if (overlay) overlay.setAttribute('aria-hidden', 'true');

    if (sidebar) {
      sidebar.style.setProperty('--toc-sheet-drag', '0px');
    }
    const handle = document.getElementById('site-toc-sheet-handle');
    if (handle) {
      handle.setAttribute('data-drag', 'idle');
    }

    const mobileToggle = document.querySelector('.toc-mobile-toggle');
    if (mobileToggle) {
      mobileToggle.setAttribute('data-state', 'closed');
    }
  }

  // Move `.post-toc` into `#site-toc-sidebar` and initialize shell
  function wireTOCSidebar() {
    const siteSidebar = document.getElementById('site-toc-sidebar');
    const postToc = document.querySelector('.post-toc');

    if (!siteSidebar || !postToc) return;

    // Prevent transition flash on page load - add no-transition class first
    siteSidebar.classList.add('no-transition');

    // Move postToc directly into sidebar (preserve content)
    if (!siteSidebar.contains(postToc)) {
      siteSidebar.appendChild(postToc);
    }
    postToc.style.display = 'block';
    siteSidebar.setAttribute('aria-hidden', 'true');
    const overlayEl = document.getElementById('site-toc-overlay');
    if (overlayEl) overlayEl.setAttribute('aria-hidden', 'true');

    // Mark sidebar as ready (makes it visible via CSS) and enable transitions after a frame
    // Use requestAnimationFrame to ensure the DOM has settled before enabling transitions
    requestAnimationFrame(() => {
      siteSidebar.classList.add('toc-ready');
      // Remove no-transition after another frame to ensure initial state is applied
      requestAnimationFrame(() => {
        siteSidebar.classList.remove('no-transition');
      });
    });

    // run auto-render on the sidebar so $$...$$ is converted
    if (typeof window.renderMathInElement === 'function') {
      window.renderMathInElement(siteSidebar, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false }
        ],
        throwOnError: false
      });
    }
  }

  function buildTOCRail() {
    const rail = document.getElementById('toc-scroll-rail');
    const sidebar = document.getElementById('site-toc-sidebar');
    const mobileToggle = document.querySelector('.toc-mobile-toggle');
    if (!rail || !sidebar) return;

    const links = Array.from(sidebar.querySelectorAll('.toc a'));
    rail.innerHTML = '';

    if (!links.length) {
      if (mobileToggle) mobileToggle.setAttribute('data-has-toc', 'false');
      rail.style.display = 'none';
      closeTOCStates();
      return;
    }

    if (mobileToggle) mobileToggle.setAttribute('data-has-toc', 'true');
    rail.style.display = 'flex';

    links.forEach((link, index) => {
      const marker = document.createElement('button');
      marker.type = 'button';
      marker.className = 'toc-rail-line';

      const text = (link.textContent || '').trim();
      const levelClass = (link.parentElement && link.parentElement.className) || '';
      let level = 2;
      const levelMatch = levelClass.match(/toc-level-(\d+)/);
      if (levelMatch) {
        const parsed = parseInt(levelMatch[1], 10);
        if (!isNaN(parsed)) level = parsed;
      }

      const baseLength = Math.min(58, Math.max(24, 16 + text.length * 1.1));
      const levelPenalty = level === 3 ? 7 : level >= 4 ? 10 : 0;
      marker.style.setProperty('--toc-line-width', `${Math.max(10, Math.min(28, baseLength - levelPenalty))}px`);

      const href = link.getAttribute('href') || '';
      marker.setAttribute('data-target', href);
      marker.setAttribute('aria-label', text ? `Jump to ${text}` : `Jump to section ${index + 1}`);

      marker.addEventListener('click', function () {
        const id = href.replace(/^#/, '');
        const target = getTargetById(id);
        if (!target) return;

        const top = target.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top, behavior: 'smooth' });
      });

      rail.appendChild(marker);
    });

  }

  function wireDesktopHoverTOC() {
    const rail = document.getElementById('toc-scroll-rail');
    const sidebar = document.getElementById('site-toc-sidebar');
    const overlay = document.getElementById('site-toc-overlay');
    if (!rail || !sidebar) return;

    let closeTimeout = null;

    const open = function () {
      if (!isDesktopViewport()) return;
      if (closeTimeout) {
        clearTimeout(closeTimeout);
        closeTimeout = null;
      }
      document.body.classList.add('toc-hover-open');
      document.body.classList.remove('toc-sheet-open');
      sidebar.setAttribute('aria-hidden', 'false');
      if (overlay) overlay.setAttribute('aria-hidden', 'true');
    };

    const close = function () {
      if (!isDesktopViewport()) return;
      closeTimeout = setTimeout(function () {
        document.body.classList.remove('toc-hover-open');
        sidebar.setAttribute('aria-hidden', 'true');
      }, 120);
    };

    rail.addEventListener('mouseenter', open);
    rail.addEventListener('mouseleave', close);

    sidebar.addEventListener('mouseenter', open);
    sidebar.addEventListener('mouseleave', close);

    // Ensure desktop starts in rail-visible mode on every initialization.
    if (isDesktopViewport()) {
      document.body.classList.remove('toc-hover-open');
      sidebar.setAttribute('aria-hidden', 'true');
    }

    if (!window._tocDesktopResizeHandler) {
      window._tocDesktopResizeHandler = function () {
        if (!isDesktopViewport()) {
          document.body.classList.remove('toc-hover-open');
        } else {
          document.body.classList.remove('toc-sheet-open');
        }
      };
      window.addEventListener('resize', window._tocDesktopResizeHandler);
    }
  }

  function wireMobileTOCSheet() {
    if (window._tocMobileHandlersAttached) return;
    window._tocMobileHandlersAttached = true;

    document.addEventListener('click', function (e) {
      const toggleBtn = e.target.closest('.toc-mobile-toggle');
      if (!toggleBtn) return;

      if (isDesktopViewport()) return;

      e.preventDefault();
      const sidebar = document.getElementById('site-toc-sidebar');
      const overlay = document.getElementById('site-toc-overlay');
      const isOpen = document.body.classList.contains('toc-sheet-open');
      if (isOpen) {
        closeTOCStates();
        return;
      }

      document.body.classList.remove('toc-hover-open');
      document.body.classList.add('toc-sheet-open');
      document.body.classList.remove('toc-sheet-dragging');
      if (sidebar) sidebar.setAttribute('aria-hidden', 'false');
      if (overlay) overlay.setAttribute('aria-hidden', 'false');
      if (sidebar) sidebar.style.setProperty('--toc-sheet-drag', '0px');
      toggleBtn.setAttribute('data-state', 'open');

      const handle = document.getElementById('site-toc-sheet-handle');
      if (handle) {
        handle.setAttribute('data-drag', 'idle');
      }

      setTimeout(() => { centerActiveInSidebar('auto'); }, 100);
    });

    document.addEventListener('click', function (e) {
      if (e.target.id === 'site-toc-overlay' && document.body.classList.contains('toc-sheet-open')) {
        closeTOCStates();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && (document.body.classList.contains('toc-sheet-open') || document.body.classList.contains('toc-hover-open'))) {
        closeTOCStates();
      }
    });
  }

  function wireBottomSheetDrag() {
    if (window._tocSheetDragAttached) return;
    window._tocSheetDragAttached = true;

    const sidebar = document.getElementById('site-toc-sidebar');
    const handle = document.getElementById('site-toc-sheet-handle');
    if (!sidebar || !handle) return;

    let dragging = false;
    let startY = 0;
    let deltaY = 0;
    let currentDrag = 0;
    let pointerId = null;
    let pendingDelta = 0;
    let rafId = 0;
    let lastMoveY = 0;
    let lastMoveTs = 0;
    let velocityY = 0;

    const DRAG_UP_LIMIT = -90;
    const DRAG_DOWN_LIMIT = 260;
    const DISMISS_DISTANCE = 78;
    const DISMISS_FLICK_VELOCITY = 0.55;

    const clampDrag = function (rawDelta) {
      const damped = rawDelta < 0 ? rawDelta * 0.62 : rawDelta * 0.94;
      return Math.max(DRAG_UP_LIMIT, Math.min(DRAG_DOWN_LIMIT, damped));
    };

    const setHandleStateForDelta = function (delta) {
      if (delta < -8) {
        handle.setAttribute('data-drag', 'up');
      } else if (delta > 8) {
        handle.setAttribute('data-drag', 'down');
      } else {
        handle.setAttribute('data-drag', 'idle');
      }
    };

    const flushDrag = function () {
      rafId = 0;
      currentDrag = clampDrag(pendingDelta);
      sidebar.style.setProperty('--toc-sheet-drag', `${currentDrag}px`);
      setHandleStateForDelta(currentDrag);
    };

    const scheduleDrag = function (rawDelta) {
      pendingDelta = rawDelta;
      if (!rafId) {
        rafId = requestAnimationFrame(flushDrag);
      }
    };

    const onPointerMove = function (event) {
      if (!dragging || pointerId !== event.pointerId) return;
      deltaY = event.clientY - startY;

      const now = performance.now();
      const dt = Math.max(1, now - lastMoveTs);
      velocityY = (event.clientY - lastMoveY) / dt;
      lastMoveY = event.clientY;
      lastMoveTs = now;

      scheduleDrag(deltaY);
      if (event.cancelable) {
        event.preventDefault();
      }
    };

    const onPointerEnd = function (event) {
      if (!dragging || pointerId !== event.pointerId) return;
      dragging = false;
      pointerId = null;

      document.body.classList.remove('toc-sheet-dragging');

      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      currentDrag = clampDrag(pendingDelta);

      const shouldDismiss = currentDrag > DISMISS_DISTANCE ||
        (velocityY > DISMISS_FLICK_VELOCITY && currentDrag > 24);
      sidebar.style.setProperty('--toc-sheet-drag', '0px');
      handle.setAttribute('data-drag', 'idle');

      if (handle.releasePointerCapture) {
        try {
          handle.releasePointerCapture(event.pointerId);
        } catch {
          // No-op if pointer capture already released.
        }
      }

      if (shouldDismiss) {
        closeTOCStates();
      }
    };

    handle.addEventListener('pointerdown', function (event) {
      if (isDesktopViewport()) return;
      if (!document.body.classList.contains('toc-sheet-open')) return;
      dragging = true;
      pointerId = event.pointerId;
      startY = event.clientY;
      deltaY = 0;
      pendingDelta = 0;
      currentDrag = 0;
      velocityY = 0;
      lastMoveY = event.clientY;
      lastMoveTs = performance.now();

      document.body.classList.add('toc-sheet-dragging');
      handle.setPointerCapture(event.pointerId);
      handle.setAttribute('data-drag', 'idle');

      if (event.cancelable) {
        event.preventDefault();
      }
    });

    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerEnd);
    handle.addEventListener('pointercancel', onPointerEnd);
  }

  // Center the currently active TOC link inside the sidebar (used on open and on load)
  function centerActiveInSidebar(behavior) {
    behavior = behavior || 'smooth';
    const sidebarEl = document.getElementById('site-toc-sidebar');
    if (!sidebarEl) return;
    // Skip if sidebar is display:none
    if (getComputedStyle(sidebarEl).display === 'none') return;
    const active = sidebarEl.querySelector('.toc a.active');
    if (!active) return;
    // Use scrollTo on the sidebar container directly instead of scrollIntoView
    // to avoid accidentally scrolling the main document
    try {
      const activeRect = active.getBoundingClientRect();
      const sidebarRect = sidebarEl.getBoundingClientRect();
      const currentScroll = sidebarEl.scrollTop;
      const offset = (activeRect.top - sidebarRect.top) - (sidebarEl.clientHeight / 2) + (activeRect.height / 2);
      sidebarEl.scrollTo({ top: currentScroll + offset, behavior: behavior });
    } catch (e) {
      // Silent fail - don't use scrollIntoView as fallback to prevent scroll fighting
    }
  }

  // Track active TOC link based on scroll position and clicks
  function wireTOCActiveTracking() {
    const sidebar = document.getElementById('site-toc-sidebar');
    const postBody = document.querySelector('.post-body');
    if (!sidebar || !postBody) return;

    const links = Array.from(sidebar.querySelectorAll('.toc a'));
    const railLines = Array.from(document.querySelectorAll('#toc-scroll-rail .toc-rail-line'));
    if (!links.length) return;

    // Map link -> target heading ID (store IDs to handle hydration/replacement)
    const linkIds = links.map(a => {
      const hash = a.getAttribute('href') || '';
      return hash.replace(/^#/, '');
    });

    // When we programmatically navigate (click -> smooth scroll), suspend
    // the scroll-based active calculation briefly to avoid jitter between
    // the click-set active state and scroll-based recalculation.
    let suspendScrollHandler = false;
    let suspendTimeoutId = null;

    // Track the last active index to avoid redundant updates
    let lastActiveIndex = -1;

    function setActive(index, shouldScrollSidebar) {
      // Skip if same index to avoid unnecessary DOM updates
      if (index === lastActiveIndex) return;
      lastActiveIndex = index;

      links.forEach((a, i) => {
        if (i === index) a.classList.add('active'); else a.classList.remove('active');
      });
      railLines.forEach((line, i) => {
        if (i === index) line.classList.add('active'); else line.classList.remove('active');
      });

      const railEl = document.getElementById('toc-scroll-rail');
      const activeRailLine = railLines[index];
      if (railEl && activeRailLine) {
        try {
          const targetTop = activeRailLine.offsetTop - (railEl.clientHeight / 2) + (activeRailLine.offsetHeight / 2);
          railEl.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
        } catch (e) {
          // Silent fail
        }
      }

      // Only scroll sidebar if explicitly requested (e.g., on TOC open, not during page scroll)
      // This prevents scroll fighting between page scroll and sidebar scroll
      if (!shouldScrollSidebar) return;

      const sidebarEl = document.getElementById('site-toc-sidebar');
      if (!sidebarEl || getComputedStyle(sidebarEl).display === 'none') {
        return;
      }
      const active = links[index];
      if (active) {
        try {
          const activeRect = active.getBoundingClientRect();
          const sidebarRect = sidebarEl.getBoundingClientRect();
          const currentScroll = sidebarEl.scrollTop;
          const offset = (activeRect.top - sidebarRect.top) - (sidebarEl.clientHeight / 2) + (activeRect.height / 2);
          sidebarEl.scrollTo({ top: currentScroll + offset, behavior: 'smooth' });
        } catch (e) {
          // Silent fail
        }
      }
    }

    // on click, mark active and scroll sidebar
    links.forEach((a, i) => {
      a.addEventListener('click', (ev) => {
        setActive(i, true); // true = scroll sidebar to active item
        suspendScrollHandler = true;
        if (suspendTimeoutId) clearTimeout(suspendTimeoutId);
        suspendTimeoutId = setTimeout(() => {
          suspendScrollHandler = false;
          suspendTimeoutId = null;
        }, 1000); // longer suspend to avoid jitter
      }, true);
    });

    // on scroll, find heading nearest to top (don't scroll sidebar - just update active class)
    function onScroll() {
      if (suspendScrollHandler) return;
      let best = -1;
      let bestOffset = Infinity;

      for (let i = 0; i < linkIds.length; i++) {
        const id = linkIds[i];
        const el = getTargetById(id); // Dynamic lookup to handle hydration

        if (!el) continue;
        // Ignore hidden or detached elements to prevent jumping to top
        if (!el.getClientRects().length) continue;

        const rect = el.getBoundingClientRect();
        const offset = Math.abs(rect.top - 120);
        if (rect.top <= 150 && offset < bestOffset) {
          best = i; bestOffset = offset;
        }
      }

      if (best >= 0) {
        setActive(best, true);
      } else if (linkIds.length > 0) {
        // Default to first item if above all headings (e.g. at top of page)
        setActive(0, true);
      }
    }

    // Use requestAnimationFrame-based throttle for smoother performance
    let ticking = false;
    const scrollHandler = function () {
      if (!ticking && !suspendScrollHandler) {
        requestAnimationFrame(function () {
          onScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    // Clean up previous listener if exists
    if (window._tocScrollHandler) {
      document.removeEventListener('scroll', window._tocScrollHandler);
    }
    window._tocScrollHandler = scrollHandler;
    document.addEventListener('scroll', scrollHandler, { passive: true });

    // initial highlight
    setTimeout(() => { onScroll(); }, 600);
  }

  // Initialize everything when DOM is ready
  function initTOC() {
    try {
      fixDuplicateIds();
    } catch (e) { }
    try {
      buildTOCFallback();
    } catch (e) {
      console.error('Error building TOC fallback:', e);
    }
    try {
      wireTOCSidebar();
    } catch (e) {
      console.error('Error wiring TOC sidebar:', e);
    }
    try {
      buildTOCRail();
    } catch (e) { }
    try {
      wireDesktopHoverTOC();
    } catch (e) { }
    try {
      wireMobileTOCSheet();
    } catch (e) { }
    try {
      wireBottomSheetDrag();
    } catch (e) { }
    try {
      wireTOCActiveTracking();
    } catch (e) { }
  }

  export { initTOC };
