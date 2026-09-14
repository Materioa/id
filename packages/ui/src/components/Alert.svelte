<script lang="ts">
  import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-svelte';
  import { slide } from 'svelte/transition';

  let { 
    type = 'info', // 'success', 'error', 'warning', 'info'
    title = '',
    message = '',
    dismissible = false,
    onDismiss = () => { isVisible = false; }
  } = $props();

  let isVisible = $state(true);

  const styles = {
    success: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    error: 'bg-destructive/10 text-destructive border-destructive/20',
    warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    info: 'bg-primary/10 text-primary border-primary/20'
  };

  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info
  };

  const IconComponent = $derived(icons[type as keyof typeof icons] || Info);
</script>

{#if isVisible}
  <div 
    class="relative w-full rounded-[16px] border p-4 flex items-start gap-3 transition-all {styles[type as keyof typeof styles]}"
    transition:slide={{ duration: 200 }}
    role="alert"
  >
    <IconComponent class="w-5 h-5 shrink-0 mt-0.5" />
    <div class="flex-1">
      {#if title}
        <h5 class="font-semibold tracking-tight text-foreground">{title}</h5>
      {/if}
      <div class="text-sm opacity-90 {title ? 'mt-1' : ''}">
        {message}
      </div>
    </div>
    
    {#if dismissible}
      <button 
        onclick={() => { onDismiss(); isVisible = false; }}
        class="shrink-0 p-1 rounded-md opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        aria-label="Dismiss alert"
      >
        <X class="w-4 h-4" />
      </button>
    {/if}
  </div>
{/if}
