<script lang="ts">
  import { onMount } from 'svelte';

  // "Open in app" nudge for Materio web apps (auth / accounts / admin).
  // - Hidden inside the native Android / desktop shells.
  // - On Android browsers it attempts a one-time silent auto-open (per
  //   session) via an intent: URL — no Play Console needed. Tapping
  //   "Open in app" uses an intent whose fallback is the downloads page,
  //   so a missing app lands on "get the app" instead of an error.
  // - On desktop it tries the materio:// scheme; if nothing handles it,
  //   the card flips to a download ask.

  let {
    packageId = 'com.materio.app',
    scheme = 'materio',
    downloadsUrl = 'https://beta.getmaterio.app/downloads',
    dismissDays = 30
  }: {
    packageId?: string;
    scheme?: string;
    downloadsUrl?: string;
    dismissDays?: number;
  } = $props();

  let visible = $state(false);
  let isAndroid = $state(false);
  let openFailed = $state(false);

  const DISMISS_KEY = 'materio_open_in_app_dismissed';
  const AUTO_KEY = 'materio_open_in_app_auto';

  function isNativeShell(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const w = window as any;
      if (w.__TAURI_INTERNALS__ || w.__TAURI__ || w.__TAURI_METADATA__) return true;
      if (w.Capacitor?.isNativePlatform && w.Capacitor.isNativePlatform()) return true;
      if (w.Capacitor?.getPlatform && w.Capacitor.getPlatform() !== 'web') return true;
      if (w.AndroidBridge) return true;
      const h = window.location?.hostname || '';
      const p = window.location?.protocol || '';
      if (p === 'tauri:' || p === 'capacitor:') return true;
      if (h === 'tauri.localhost' || h === 'capacitor.localhost') return true;
    } catch {}
    return false;
  }

  function dismissedRecently(): boolean {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return false;
      return Date.now() - parseInt(raw, 10) < dismissDays * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }

  function currentPath(): string {
    try {
      return window.location.pathname + window.location.search + window.location.hash;
    } catch {
      return '/';
    }
  }

  function host(): string {
    try {
      return window.location.host;
    } catch {
      return 'beta.getmaterio.app';
    }
  }

  // Silent auto-open falls back to this same page, so a missing app
  // just sees the nudge below.
  function intentUrl(fallback?: string): string {
    const fb = encodeURIComponent(fallback || window.location.href);
    return `intent://${host()}${currentPath()}#Intent;scheme=https;package=${packageId};S.browser_fallback_url=${fb};end`;
  }

  function schemeUrl(): string {
    return `${scheme}://${host()}${currentPath()}`;
  }

  function openInApp() {
    // If the card is already in the failed state the button is a plain
    // download link (see template) — this path is the first tap only.
    if (openFailed) return;
    try {
      openFailed = false;
      let left = false;
      const onHide = () => {
        left = true;
      };
      window.addEventListener('pagehide', onHide, { once: true });
      window.addEventListener('blur', onHide, { once: true });
      // Android: intent: URL opens the app without any Play Console
      // setup; a missing app falls back to this page (see timer).
      // Desktop: tries the registered materio:// protocol.
      window.location.href = isAndroid ? intentUrl(window.location.href) : schemeUrl();
      setTimeout(() => {
        window.removeEventListener('pagehide', onHide);
        window.removeEventListener('blur', onHide);
        if (!left) openFailed = true;
      }, isAndroid ? 2200 : 1400);
    } catch {}
  }

  function dismiss() {
    visible = false;
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  }

  onMount(() => {
    if (typeof window === 'undefined') return;
    if (isNativeShell()) return;
    if (dismissedRecently()) return;
    try {
      isAndroid = /Android/i.test(navigator?.userAgent || '');
    } catch {}
    if (isAndroid) {
      try {
        if (!sessionStorage.getItem(AUTO_KEY)) {
          sessionStorage.setItem(AUTO_KEY, '1');
          setTimeout(() => {
            try {
              window.location.href = intentUrl();
            } catch {}
          }, 900);
        }
      } catch {}
    }
    const t = setTimeout(() => {
      visible = true;
    }, isAndroid ? 2200 : 1200);
    return () => clearTimeout(t);
  });
</script>

{#if visible}
  <div class="mia-banner" role="dialog" aria-label="Open in the Materio app">
    {#if openFailed}
      <div class="mia-text">
        <strong>Couldn't open the app</strong>
        <span>It may not be installed yet — download it to continue.</span>
      </div>
      <div class="mia-actions">
        <a class="mia-primary" href={downloadsUrl} target="_blank" rel="noopener noreferrer">Download</a>
        <button type="button" class="mia-dismiss" onclick={dismiss} aria-label="Dismiss">✕</button>
      </div>
    {:else}
      <div class="mia-text">
        <strong>Materio is better in the app</strong>
        <span>Open this page in the app for the full experience.</span>
      </div>
      <div class="mia-actions">
        <button type="button" class="mia-primary" onclick={openInApp}>Open in app</button>
        <button type="button" class="mia-dismiss" onclick={dismiss} aria-label="Dismiss">✕</button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .mia-banner {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: 12px;
    z-index: 9000;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 16px;
    background: #171814;
    color: #f4f4ee;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
    font-size: 13px;
  }
  .mia-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .mia-text strong {
    font-size: 13px;
  }
  .mia-text span {
    font-size: 12px;
    opacity: 0.75;
  }
  .mia-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .mia-primary {
    border: none;
    border-radius: 10px;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 600;
    background: hsl(var(--primary, 24 100% 50%));
    color: #fff;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
  }
  .mia-dismiss {
    background: none;
    border: none;
    color: inherit;
    opacity: 0.6;
    cursor: pointer;
    font-size: 14px;
    padding: 4px;
  }
</style>
