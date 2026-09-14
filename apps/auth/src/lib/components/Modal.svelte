<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { X } from 'lucide-svelte';
  import { fade, fly } from 'svelte/transition';

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    };
  }

  let { 
    isOpen = $bindable(false), 
    title = '',
    maxWidthClass = 'sm:max-w-lg',
    onClose,
    children
  }: {
    isOpen?: boolean;
    title?: string;
    maxWidthClass?: string;
    onClose?: () => void;
    children?: any;
  } = $props();

  function handleClose() {
    isOpen = false;
    if (onClose) onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && isOpen) {
      handleClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
  <div use:portal class="fixed inset-0 z-[9999]">
    <!-- Backdrop -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
      class="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity"
      transition:fade={{ duration: 200 }}
      onclick={handleClose}
    ></div>

  <!-- Modal Container -->
  <div 
    class="fixed inset-x-0 bottom-0 z-50 mt-24 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:mt-0"
    role="dialog" 
    aria-modal="true"
  >
    <!-- Modal Panel (Bottom sheet on mobile, rounded modal on desktop) -->
    <div 
      class="relative flex flex-col w-full bg-card sm:rounded-[24px] rounded-t-[32px] border border-border {maxWidthClass} shadow-2xl max-h-[90vh] overflow-hidden"
      transition:fly={{ y: 50, duration: 300, opacity: 0 }}
    >
      <!-- Mobile drag handle -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="sm:hidden flex justify-center pt-3 pb-1 w-full" onclick={handleClose}>
        <div class="w-12 h-1.5 rounded-full bg-muted-foreground/30"></div>
      </div>

      <!-- Header -->
      {#if title}
        <div class="flex items-center justify-between px-6 pt-4 pb-2 sm:py-6 border-b border-border/50">
          <h2 class="text-lg font-semibold text-foreground">{title}</h2>
          <button 
            onclick={handleClose}
            class="p-2 -mr-2 rounded-full hover:bg-muted text-muted-foreground active:scale-[0.95] transition-all"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
      {:else}
        <div class="absolute top-4 right-4 z-10">
          <button 
            onclick={handleClose}
            class="p-2 rounded-full bg-background/50 backdrop-blur-sm hover:bg-muted text-muted-foreground active:scale-[0.95] transition-all"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
      {/if}

      <!-- Content -->
      <div class="p-6 overflow-y-auto">
        {@render children()}
      </div>
    </div>
  </div>
  </div>
{/if}
