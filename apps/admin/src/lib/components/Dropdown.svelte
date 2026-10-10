<script lang="ts">
  import { ChevronDown, Check } from 'lucide-svelte';
  import { fade, fly } from 'svelte/transition';
  import { onMount } from 'svelte';

  let { 
    id = '',
    options = [], // [{ value: '1', label: 'Option 1' }]
    value = $bindable(''), 
    placeholder = 'Select an option',
    disabled = false,
    compact = false,
    buttonClass = '',
    align = 'left',
    resetOnSelect = false,
    direction = 'auto',
    onchange = undefined
  } = $props();

  let isOpen = $state(false);
  let openUpward = $state(false);
  let dropdownRef: HTMLDivElement;

  const selectedOption = $derived(options.find((o: any) => o.value === value));

  function toggle() {
    if (!disabled) {
      if (!isOpen && dropdownRef && typeof window !== 'undefined') {
        if (direction === 'up') {
          openUpward = true;
        } else if (direction === 'down') {
          openUpward = false;
        } else {
          const rect = dropdownRef.getBoundingClientRect();
          openUpward = (window.innerHeight - rect.bottom) < 220;
        }
      }
      isOpen = !isOpen;
    }
  }

  function selectOption(val: string) {
    if (!resetOnSelect) {
      value = val;
    }
    isOpen = false;
    onchange?.(val);
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
  aria-controls="{id}-listbox"
>
  <button
    id={id}
    type="button"
    class="w-full flex items-center justify-between gap-1.5 {compact ? 'px-2.5 py-1 text-xs rounded-lg' : 'px-4 py-3 text-sm rounded-xl'} bg-background border border-border shadow-2xs text-left focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all {disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-border/80 active:scale-[0.98] cursor-pointer'} {buttonClass}"
    onclick={toggle}
    {disabled}
  >
    <span class="block truncate {selectedOption ? 'text-foreground' : 'text-muted-foreground'}">
      {selectedOption ? selectedOption.label : placeholder}
    </span>
    <ChevronDown class="{compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-muted-foreground transition-transform duration-200 shrink-0 {isOpen ? 'rotate-180' : ''}" />
  </button>

  {#if isOpen}
    <div 
      class="absolute z-[9999] min-w-full {align === 'right' ? 'right-0' : 'left-0'} {openUpward ? 'bottom-full mb-1.5' : 'mt-1.5'} bg-card border border-border {compact ? 'rounded-lg' : 'rounded-xl'} shadow-xl overflow-hidden max-h-60 overflow-y-auto"
      transition:fly={{ y: openUpward ? 6 : -6, duration: 150 }}
    >
      <div class="py-1">
        {#each options as option}
          <button 
            type="button"
            class="w-full flex items-center justify-between gap-2 {compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'} hover:bg-muted transition-colors {value === option.value ? 'text-primary font-medium bg-primary/5' : 'text-foreground'}"
            onclick={() => selectOption(option.value)}
          >
            <span class="block truncate">{option.label}</span>
            {#if value === option.value}
              <Check class="{compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-primary shrink-0" />
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
