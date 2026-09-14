<script lang="ts">
  import { onMount } from 'svelte';
  import { userStore } from '$lib/stores/user.svelte';
  import { getAppUrls } from '@materio/config';

  onMount(() => {
    userStore.logout();
    const appUrls = getAppUrls(window.location.origin);
    window.location.href = `${appUrls.auth}/logout?callback=${encodeURIComponent(window.location.origin)}`;
  });
</script>

<div class="min-h-screen bg-background flex items-center justify-center" aria-busy="true">
  <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
</div>
