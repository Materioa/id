<script lang="ts">
  import '@materio/ui/styles.css';
  import '../app.css';
  import { onMount } from 'svelte';

  let { children } = $props();

  onMount(() => {
    const savedTheme = localStorage.getItem('materio_theme') || 'system';
    const isDark = savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const current = localStorage.getItem('materio_theme') || 'system';
      if (current === 'system') {
        if (mediaQuery.matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  });
</script>

{@render children()}
