<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { getAppUrls } from '@materio/config';

  onMount(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    if (code) {
      goto(`/auth/callback?code=${encodeURIComponent(code)}`);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      const appUrls = getAppUrls(window.location.origin);
      window.location.href = `${appUrls.auth}/login?callback=${encodeURIComponent(window.location.origin + '/auth/callback')}`;
    } else {
      goto('/admin/overview');
    }
  });
</script>

<div class="min-h-screen bg-background" aria-busy="true"></div>
