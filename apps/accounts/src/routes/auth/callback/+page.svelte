<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { userStore } from '$lib/stores/user.svelte';
  import { getAppUrls, setClientCookie } from '@materio/config';

  let errorMsg = $state('');

  onMount(async () => {
    const code = $page.url.searchParams.get('code');
    const next = $page.url.searchParams.get('next') || '/overview';

    if (!code) {
      errorMsg = 'No authentication code provided.';
      const appUrls = getAppUrls(window.location.origin);
      setTimeout(() => window.location.href = `${appUrls.auth}/login?callback=` + encodeURIComponent(window.location.origin + '/auth/callback'), 2000);
      return;
    }

    try {
      const res = await fetch('/api/v2/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'exchange', code })
      });

      const data = await res.json() as any;

      if (!res.ok) {
        throw new Error(data.error || 'Failed to authenticate');
      }

      if (data.token) {
        localStorage.setItem('token', data.token);
        setClientCookie('materio_token', data.token);
        if (data.user) {
          userStore.setUser(data.user);
        }
        goto(next);
      } else {
        throw new Error('No token received');
      }
    } catch (e: any) {
      errorMsg = e.message;
      const appUrls = getAppUrls(window.location.origin);
      setTimeout(() => window.location.href = `${appUrls.auth}/login?callback=` + encodeURIComponent(window.location.origin + '/auth/callback'), 3000);
    }
  });
</script>

<div class="min-h-screen w-full flex items-center justify-center bg-background p-4">
  <div class="w-full max-w-sm text-center">
    <div class="inline-block animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
    <h2 class="text-xl font-semibold mb-2">Authenticating...</h2>
    {#if errorMsg}
      <p class="text-destructive font-medium">{errorMsg}</p>
    {:else}
      <p class="text-muted-foreground">Please wait while we log you in securely.</p>
    {/if}
  </div>
</div>
