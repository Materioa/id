<svelte:head>
  <title>Materio Account</title>
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getAppUrls } from '@materio/config';

  onMount(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    if (code) {
      goto(`/auth/callback?code=${encodeURIComponent(code)}`);
      return;
    }

    const token = localStorage.getItem('token');
    if (token) {
      goto('/overview');
    } else {
      const appUrls = getAppUrls(window.location.origin);
      window.location.href = `${appUrls.auth}/login?callback=${encodeURIComponent(window.location.origin + '/auth/callback')}`;
    }
  });
</script>

<div class="min-h-screen bg-background" aria-busy="true"></div>
