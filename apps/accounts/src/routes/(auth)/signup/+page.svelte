<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { getAppUrls } from '@materio/config';

  onMount(() => {
    const callback = $page.url.searchParams.get('callback') || (window.location.origin + '/auth/callback');
    const appUrls = getAppUrls(window.location.origin);
    window.location.href = `${appUrls.auth}/signup?callback=${encodeURIComponent(callback)}`;
  });
</script>

<div class="min-h-screen bg-background flex items-center justify-center" aria-busy="true">
  <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
</div>
