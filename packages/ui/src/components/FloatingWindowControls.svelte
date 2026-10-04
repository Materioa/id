<script lang="ts">
  import { onMount } from 'svelte';

  // Floating window controls (minimize / maximise / close) for the pages
  // the desktop app shows without the Materio app header — i.e. every page
  // of these web apps when they are loaded inside the Tauri webview
  // (SSO navigates the shell to accounts.getmaterio.app / auth.getmaterio.app).
  //
  // The shell window is created with `decorations: false`, so without this
  // there is NO way to minimise/close while on these origins. In a regular
  // browser (or Android) nothing is rendered.
  //
  // IPC note: Tauri checks EVERY invoke against the ACL when the page is on a
  // remote origin, and app-defined commands (app_window_*) are in no ACL
  // manifest, so they are rejected on accounts/auth. The window plugin
  // commands are grantable via the capability (core:window:allow-*), so they
  // are tried as well - on every origin the capability's remote.urls covers.
  // If all paths fail the reason is surfaced instead of silently doing nothing.

  let isDesktopApp = $state(false);
  let isMaximized = $state(false);
  let lastError = $state('');
  let hint = $state('');

  const g = (): any => globalThis as any;

  const tauriWindow = (): any => {
    try {
      if (g().__TAURI__?.window?.getCurrentWindow) return g().__TAURI__.window.getCurrentWindow();
    } catch {}
    return null;
  };

  /** Invoke each candidate command in turn (global API first, internals as a
   *  fallback for origins where only __TAURI_INTERNALS__ is injected). */
  async function invokeFirst<T = unknown>(
    cmds: string[]
  ): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
    const t = g();
    const paths: Array<(c: string) => Promise<any>> = [];
    if (typeof t.__TAURI__?.core?.invoke === 'function') paths.push((c) => t.__TAURI__.core.invoke(c));
    if (typeof t.__TAURI_INTERNALS__?.invoke === 'function') paths.push((c) => t.__TAURI_INTERNALS__.invoke(c));
    let last = 'no-ipc-bridge';
    for (const cmd of cmds) {
      for (const p of paths) {
        try {
          return { ok: true, value: (await p(cmd)) as T };
        } catch (e: any) {
          last = String((e && (e.message || e.code)) || e);
        }
      }
    }
    return { ok: false, error: last };
  }

  function reportError(what: string, error: string) {
    lastError = `${what}: ${error}`;
    try {
      (globalThis as any).__materioWindowControlError = lastError;
      console.error('[FloatingWindowControls]', lastError);
    } catch {}
    hint = lastError;
    setTimeout(() => {
      if (hint === lastError) hint = '';
    }, 8000);
  }

  async function run(appCmd: string, pluginCmd: string, what: string) {
    const r = await invokeFirst([appCmd, pluginCmd]);
    if (r.ok) return true;
    try {
      const w = tauriWindow();
      if (w) {
        const fn = { 'app_window_minimize': 'minimize', 'app_window_toggle_maximize': 'toggleMaximize', 'app_window_close': 'close' }[appCmd];
        if (fn && typeof w[fn] === 'function') {
          await w[fn]();
          return true;
        }
      }
    } catch (e: any) {
      r.error = String((e && (e.message || e.code)) || e);
    }
    reportError(what, r.error);
    return false;
  }

  async function checkMaximized() {
    if (!isDesktopApp) return;
    const r = await invokeFirst<boolean>(['app_window_is_maximized', 'plugin:window|is_maximized']);
    if (r.ok) {
      isMaximized = Boolean(r.value);
      return;
    }
    try {
      const w = tauriWindow();
      if (w) isMaximized = Boolean(await w.isMaximized());
    } catch (e: any) {
      lastError = String((e && (e.message || e.code)) || e);
    }
  }

  async function handleMinimize() {
    if (await run('app_window_minimize', 'plugin:window|minimize', 'minimize')) return;
  }

  async function handleToggleMaximize() {
    if (await run('app_window_toggle_maximize', 'plugin:window|toggle_maximize', 'toggle-maximize')) {
      setTimeout(checkMaximized, 120);
    }
  }

  async function handleClose() {
    if (await run('app_window_close', 'plugin:window|close', 'close')) return;
  }

  onMount(() => {
    if (typeof window === 'undefined') return;
    const w: any = globalThis as any;
    isDesktopApp = Boolean(
      w.__TAURI_INTERNALS__ ||
        w.__TAURI__ ||
        w.__TAURI_METADATA__ ||
        window.location?.hostname === 'tauri.localhost' ||
        window.location?.protocol === 'tauri:'
    );
    if (isDesktopApp) {
      checkMaximized();
      const onResize = () => checkMaximized();
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
  });
</script>

{#if isDesktopApp}
  <div
    class="floating-window-controls"
    aria-label="Window Controls"
    title={lastError || undefined}
    data-materio-window-control-error={lastError || undefined}
  >
    <button
      type="button"
      class="window-control-btn btn-min"
      onclick={(e) => {
        e.stopPropagation();
        handleMinimize();
      }}
      aria-label="Minimize"
      title="Minimize"
    >
      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M 0 5.5 H 10" stroke="currentColor" stroke-width="1" />
      </svg>
    </button>
    <button
      type="button"
      class="window-control-btn btn-max"
      onclick={(e) => {
        e.stopPropagation();
        handleToggleMaximize();
      }}
      aria-label={isMaximized ? 'Restore' : 'Maximize'}
      title={isMaximized ? 'Restore' : 'Maximize'}
    >
      {#if isMaximized}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M 2.5 2.5 V 2 C 2.5 1.17 3.17 0.5 4 0.5 H 8 C 8.83 0.5 9.5 1.17 9.5 2 V 6 C 9.5 6.83 8.83 7.5 8 7.5 H 7.5"
            stroke="currentColor"
            stroke-width="1"
          />
          <rect x="0.5" y="2.5" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1" />
        </svg>
      {:else}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="0.5" y="0.5" width="9" height="9" rx="2" stroke="currentColor" stroke-width="1" />
        </svg>
      {/if}
    </button>
    <button
      type="button"
      class="window-control-btn btn-close"
      onclick={(e) => {
        e.stopPropagation();
        handleClose();
      }}
      aria-label="Close"
      title="Close"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M 1 1 L 9 9 M 9 1 L 1 9" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" />
      </svg>
    </button>
  </div>
  {#if hint}
    <div class="floating-window-controls-hint" role="status">{hint}</div>
  {/if}
{/if}

<style>
  .floating-window-controls {
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 2147483640;
    display: flex;
    align-items: center;
    gap: 2px;
    height: 32px;
    padding: 0 4px;
    border-radius: 999px;
    /* Light pill by default (these apps start light); html.dark flips it. */
    background: rgba(255, 255, 255, 0.82);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid rgba(0, 0, 0, 0.08);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    -webkit-app-region: no-drag;
    app-region: no-drag;
    user-select: none;
  }

  :global(html.dark) .floating-window-controls {
    background: rgba(0, 0, 0, 0.42);
    border-color: rgba(255, 255, 255, 0.14);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.22);
  }

  .window-control-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 24px;
    background: transparent;
    border: none;
    border-radius: 999px;
    color: #333333;
    cursor: pointer;
    transition:
      background-color 0.12s ease,
      color 0.12s ease;
    padding: 0;
    margin: 0;
    flex-shrink: 0;
    -webkit-app-region: no-drag;
    app-region: no-drag;
  }

  :global(html.dark) .window-control-btn {
    color: #e0e0e0;
  }

  .window-control-btn:hover {
    background-color: rgba(128, 128, 128, 0.28);
  }

  :global(html.dark) .window-control-btn:hover {
    background-color: rgba(255, 255, 255, 0.14);
  }

  .window-control-btn.btn-close:hover {
    background-color: #c42b1c;
    color: #ffffff;
  }

  .window-control-btn.btn-close:active {
    background-color: #b22518;
    color: #ffffff;
  }

  /* Only ever visible when every invoke path failed - the reason used to be
     swallowed, which made "the buttons do nothing" undiagnosable. */
  .floating-window-controls-hint {
    position: fixed;
    top: 50px;
    right: 12px;
    z-index: 2147483640;
    max-width: 340px;
    padding: 6px 10px;
    border-radius: 10px;
    background: #b22518;
    color: #ffffff;
    font: 500 11px/1.35 ui-sans-serif, system-ui, sans-serif;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
    -webkit-app-region: no-drag;
    app-region: no-drag;
    pointer-events: none;
  }
</style>
