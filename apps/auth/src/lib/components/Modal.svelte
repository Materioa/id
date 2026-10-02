<script lang="ts">
  import { X } from 'lucide-svelte';
  import { fade, fly } from 'svelte/transition';
  import { openOverlay } from '@materio/ui/overlay';
  import type { Snippet } from 'svelte';

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node);
      }
    };
  }

  let {
    isOpen = $bindable(false),
    title = '',
    maxWidthClass = 'sm:max-w-lg',
    onClose,
    header,
    children,
    panelClass = ''
  }: {
    isOpen?: boolean;
    title?: string;
    maxWidthClass?: string;
    onClose?: () => void;
    header?: Snippet;
    children?: Snippet;
    panelClass?: string;
  } = $props();

  let isTop = $state(true);
  let layerZ = $state(0);
  let release: (() => void) | null = null;
  let panelEl: HTMLElement | null = $state(null);
  let restoreFocus: HTMLElement | null = null;

  function handleClose() {
    // Only the topmost dialog may dismiss itself — a dialog underneath a
    // nested one must not vanish out from under it.
    if (!isTop) return;
    isOpen = false;
    onClose?.();
  }

  // Keydown lives on the document so it works regardless of focus position,
  // but we only act when this dialog is the top of the stack.
  $effect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !isTop) return;
      e.stopPropagation();
      handleClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  });

  $effect(() => {
    if (!isOpen) return;
    restoreFocus = (document.activeElement as HTMLElement) || null;
    const layer = openOverlay((top) => (isTop = top));
    layerZ = layer.z;
    release = layer.release;

    // Move focus into the dialog once it exists.
    queueMicrotask(() => {
      const target = panelEl?.querySelector<HTMLElement>(
        '[data-autofocus], input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      target?.focus({ preventScroll: true });
    });

    return () => {
      release?.();
      release = null;
      isTop = true;
      try { restoreFocus?.focus?.({ preventScroll: true }); } catch { /* element gone */ }
    };
  });
</script>

{#if isOpen}
  <div use:portal class="fixed inset-0" style="z-index: {layerZ}">
    <div
      class="fixed inset-0 bg-black/55 dark:bg-black/75 backdrop-blur-sm transition-opacity"
      transition:fade={{ duration: 180 }}
      onclick={handleClose}
      aria-hidden="true"
    ></div>

    <div class="fixed inset-0 flex items-end justify-center sm:items-center sm:p-6">
      <div
        bind:this={panelEl}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' && title ? title : undefined}
        class="relative flex flex-col w-full bg-card sm:rounded-2xl rounded-t-2xl border border-border/80 {maxWidthClass} {panelClass} shadow-[0_8px_36px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_36px_rgba(0,0,0,0.4)] max-h-[90vh] overflow-hidden"
        transition:fly={{ y: 40, duration: 240, opacity: 0 }}
      >
        <!-- Mobile drag handle -->
        <button
          type="button"
          tabindex="-1"
          aria-hidden="true"
          class="sm:hidden shrink-0 cursor-grab"
          onclick={handleClose}
        >
          <span class="block w-12 h-1 rounded-full bg-muted-foreground/30 mx-auto my-3"></span>
        </button>

        {#if header}
          <div class="flex items-start justify-between gap-3 px-6 pt-2 pb-4 sm:py-5 border-b border-border/60">
            <div class="flex-1 min-w-0">{@render header()}</div>
            <button
              type="button"
              onclick={handleClose}
              class="p-2 -mr-2 rounded-full hover:bg-muted text-muted-foreground active:scale-[0.95] transition-all shrink-0"
              aria-label="Close"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        {:else if title}
          <div class="flex items-start justify-between gap-3 px-6 pt-2 pb-4 sm:py-5 border-b border-border/60">
            <h2 class="text-xl font-serif font-normal text-foreground tracking-tight">{title}</h2>
            <button
              type="button"
              onclick={handleClose}
              class="p-2 -mr-2 rounded-full hover:bg-muted text-muted-foreground active:scale-[0.95] transition-all shrink-0"
              aria-label="Close"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        {:else}
          <div class="absolute top-4 right-4 z-10">
            <button
              type="button"
              onclick={handleClose}
              class="p-2 rounded-full bg-background/50 backdrop-blur-sm hover:bg-muted text-muted-foreground active:scale-[0.95] transition-all"
              aria-label="Close"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        {/if}

        <div class="px-6 pb-6 pt-4 overflow-y-auto">
          {@render children?.()}
        </div>
      </div>
    </div>
  </div>
{/if}