<script lang="ts">
  import { ChevronDown, Check } from 'lucide-svelte';
  import { fade, fly } from 'svelte/transition';
  import { onMount } from 'svelte';

  let { 
    id = '',
    options = [], // [{ value: '1', label: 'Option 1' }]
    value = $bindable(''), 
    placeholder = 'Select an option',
    disabled = false
  } = $props();

  let isOpen = $state(false);
  let dropdownRef: HTMLDivElement;

  const selectedOption = $derived(options.find((o: any) => o.value === value));

  function toggle() {
    if (!disabled) isOpen = !isOpen;
  }

  function selectOption(val: string) {
    value = val;
    isOpen = false;
  }

  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
        isOpen = false;
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });
</script>

<div 
  bind:this={dropdownRef}
  class="relative w-full"
  role="combobox"
  aria-expanded={isOpen}
>
  <button
    id={id}
    type="button"
    class="w-full flex items-center justify-between px-3.5 py-2.5 bg-background border border-border/80 rounded-lg shadow-sm text-left focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm {disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-border active:scale-[0.99] cursor-pointer'}"
    onclick={toggle}
    {disabled}
  >
    <span class="block truncate {selectedOption ? 'text-foreground' : 'text-muted-foreground'}">
      {selectedOption ? selectedOption.label : placeholder}
    </span>
    <ChevronDown class="w-4 h-4 text-muted-foreground transition-transform duration-150 {isOpen ? 'rotate-180' : ''}" />
  </button>

  {#if isOpen}
    <div 
      class="absolute z-50 w-full mt-1.5 bg-card border border-border/80 rounded-lg shadow-md overflow-hidden max-h-60 overflow-y-auto"
      transition:fly={{ y: -6, duration: 150 }}
    >
      <div class="py-1">
        {#each options as option}
          <button 
            type="button"
            class="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted transition-colors {value === option.value ? 'text-primary font-medium bg-primary/5' : 'text-foreground'}"
            onclick={() => selectOption(option.value)}
          >
            <span class="block truncate">{option.label}</span>
            {#if value === option.value}
              <Check class="w-4 h-4 text-primary" />
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
