<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { getAppUrls } from '@materio/config';

  onMount(() => {
    const appUrls = getAppUrls(window.location.origin);
    const search = $page.url.search;
    window.location.href = `${appUrls.auth}/authorize${search}`;
  });
</script>

<div class="min-h-screen bg-background flex items-center justify-center" aria-busy="true">
  <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
</div>
