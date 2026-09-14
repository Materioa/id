<script lang="ts">
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { CheckmarkBadge01Icon } from '@hugeicons/core-free-icons';

  let { 
    checked = $bindable(false), 
    id = `checkbox-${Math.random().toString(36).substring(2, 9)}`, 
    label = '',
    disabled = false,
    onchange
  }: {
    checked?: boolean;
    id?: string;
    label?: string;
    disabled?: boolean;
    onchange?: (e: Event) => void;
  } = $props();
</script>

<div class="flex items-center gap-3">
  <div class="relative flex items-center justify-center">
    <input 
      type="checkbox" 
      {id} 
      bind:checked 
      {disabled}
      {onchange}
      class="peer appearance-none w-5 h-5 border border-border/80 rounded-md bg-transparent checked:bg-primary checked:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    />
    <!-- Custom checkmark SVG -->
    <svg 
      class="absolute w-3.5 h-3.5 text-primary-foreground pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity duration-200" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      stroke-width="3" 
      stroke-linecap="round" 
      stroke-linejoin="round"
    >
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  </div>
  {#if label}
    <label for={id} class="text-sm text-foreground cursor-pointer select-none {disabled ? 'opacity-50 cursor-not-allowed' : ''}">
      {label}
    </label>
  {/if}
</div>
