<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  let { postId, slug, title }: { postId: string; slug: string; title: string } = $props();

  let sessionId = '';
  let duration = 0;
  let scrollDepth = 0;
  let lastLeftOff = 'Beginning';
  let claps = 0;

  let clicks: Array<{ id: string; tag: string; text: string; timestamp: Date }> = [];
  let settingsChanges: Array<{ type: string; value: string; timestamp: Date }> = [];

  let intervalId: any;
  let activeTimerId: any;
  let isPageActive = true;
  let isUserIdle = false;
  let idleTimeoutId: any;

  function getOrCreateSessionId() {
    const storageKey = `insightroom_session_${postId}`;
    let storedSession = null;

    try {
      storedSession = sessionStorage.getItem(storageKey);
    } catch {}

    if (storedSession) return storedSession;

    let newId = '';
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      newId = crypto.randomUUID();
    } else {
      newId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    try {
      sessionStorage.setItem(storageKey, newId);
    } catch {}

    return newId;
  }

  function resetIdleTimer() {
    isUserIdle = false;
    if (idleTimeoutId) clearTimeout(idleTimeoutId);
    idleTimeoutId = setTimeout(() => {
      isUserIdle = true;
    }, 90000);
  }

  function getPayload() {
    return {
      postId,
      slug,
      title,
      sessionId,
      duration,
      scrollDepth,
      lastLeftOff,
      claps,
      clicks,
      settingsChanges
    };
  }

  function sendTelemetry(isFinal = false) {
    if (!browser || !sessionId || !postId) return;

    const payload = getPayload();

    if (duration === 0 && clicks.length === 0 && claps === 0 && scrollDepth === 0 && !isFinal) {
      return;
    }

    const url = '/api/analytics/track';
    const bodyStr = JSON.stringify(payload);

    if (isFinal && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([bodyStr], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    } else {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
        keepalive: true
      }).catch(() => {});
    }
  }

  function updateScrollDepth() {
    if (!browser) return;
    const docElem = document.documentElement;
    const winHeight = window.innerHeight;
    const docHeight = docElem.scrollHeight;

    if (docHeight <= winHeight) {
      scrollDepth = 100;
      return;
    }

    const scrollTop = window.scrollY || docElem.scrollTop;
    const currentPercent = Math.round((scrollTop / (docHeight - winHeight)) * 100);

    if (currentPercent > scrollDepth) {
      scrollDepth = Math.min(100, currentPercent);
    }

    const headings = Array.from(document.querySelectorAll('h1, h2, h3'));
    for (let i = headings.length - 1; i >= 0; i--) {
      const heading = headings[i];
      const rect = heading.getBoundingClientRect();
      if (rect.top <= winHeight * 0.4) {
        lastLeftOff = heading.textContent?.trim() || lastLeftOff;
        break;
      }
    }
  }

  function handleClick(e: MouseEvent) {
    const target = (e.target as HTMLElement)?.closest('button, a, input, select');
    if (!target) return;

    resetIdleTimer();

    const elId = target.id || target.getAttribute('name') || '';
    const tag = target.tagName.toLowerCase();
    const text = target.textContent?.trim().substring(0, 50) || target.getAttribute('aria-label') || '';

    if (clicks.length < 50) {
      clicks.push({
        id: elId,
        tag,
        text,
        timestamp: new Date()
      });
    }
  }

  function handleVisibilityChange() {
    isPageActive = document.visibilityState === 'visible';
    if (isPageActive) {
      resetIdleTimer();
    } else {
      sendTelemetry();
    }
  }

  onMount(() => {
    sessionId = getOrCreateSessionId();

    sendTelemetry();

    intervalId = setInterval(() => {
      sendTelemetry();
    }, 15000);

    activeTimerId = setInterval(() => {
      if (isPageActive && !isUserIdle) {
        duration += 1;
      }
    }, 1000);

    window.addEventListener('scroll', updateScrollDepth, { passive: true });
    window.addEventListener('mousemove', resetIdleTimer, { passive: true });
    window.addEventListener('keydown', resetIdleTimer, { passive: true });
    window.addEventListener('click', handleClick, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    window.addEventListener('beforeunload', () => sendTelemetry(true));
    window.addEventListener('pagehide', () => sendTelemetry(true));

    return () => {
      sendTelemetry(true);
      clearInterval(intervalId);
      clearInterval(activeTimerId);
      if (idleTimeoutId) clearTimeout(idleTimeoutId);

      window.removeEventListener('scroll', updateScrollDepth);
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      window.removeEventListener('click', handleClick);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  });
</script>
