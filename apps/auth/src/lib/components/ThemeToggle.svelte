<script lang="ts">
  import { onMount } from 'svelte';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { Sun01Icon, Moon02Icon } from '@hugeicons/core-free-icons';

  let isDark = $state(false);

  onMount(() => {
    isDark = document.documentElement.classList.contains('dark');
  });

  function toggleTheme() {
    isDark = !isDark;
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('materio_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('materio_theme', 'light');
    }
  }
</script>

<button
  type="button"
  onclick={toggleTheme}
  class="relative p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer select-none"
  title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
  aria-label="Toggle theme"
>
  {#if isDark}
    <HugeiconsIcon icon={Sun01Icon} size={16} class="transition-transform hover:rotate-45" />
  {:else}
    <HugeiconsIcon icon={Moon02Icon} size={16} class="transition-transform hover:-rotate-12" />
  {/if}
</button>
