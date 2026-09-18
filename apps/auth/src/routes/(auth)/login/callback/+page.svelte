<svelte:head>
  <title>Authenticating... - Materio ID</title>
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { getAppUrls, setClientCookie } from '@materio/config';
  import AuthCard from '$lib/components/AuthCard.svelte';
  import LineArtBackground from '$lib/components/LineArtBackground.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import BudLogo from '$lib/components/BudLogo.svelte';

  onMount(() => {
    const token = $page.url.searchParams.get('token');
    const handoffCode = $page.url.searchParams.get('handoffCode');
    const provider = $page.url.searchParams.get('provider');
    const callback = $page.url.searchParams.get('callback');

    if (token) {
      localStorage.setItem('token', token);
      setClientCookie('materio_token', token);
    }

    if (provider) {
      try {
        localStorage.setItem('last_auth_provider', provider);
      } catch {}
    }

    // Redirect to destination
    if (callback) {
      try {
        const cbUrl = new URL(callback);
        // If the callback is within the auth app itself (e.g. /authorize), return directly!
        if (cbUrl.origin === window.location.origin) {
          window.location.href = cbUrl.toString();
          return;
        }

        if (handoffCode) {
          if (!cbUrl.pathname.includes('/auth/callback')) {
            const nextPath = cbUrl.pathname + cbUrl.search;
            cbUrl.pathname = '/auth/callback';
            cbUrl.search = '';
            cbUrl.searchParams.set('code', handoffCode);
            if (nextPath && nextPath !== '/') {
              cbUrl.searchParams.set('next', nextPath);
            }
          } else {
            cbUrl.searchParams.set('code', handoffCode);
          }
        }
        window.location.href = cbUrl.toString();
        return;
      } catch {}
    }

    const appUrls = getAppUrls(typeof window !== 'undefined' ? window.location.origin : undefined);
    if (handoffCode) {
      window.location.href = `${appUrls.accounts}/auth/callback?code=${handoffCode}`;
    } else {
      window.location.href = `${appUrls.accounts}/overview`;
    }
  });
</script>

<style>
  .auth-viewport {
    background-color: #f7f7f2;
    color: #0e0f0c;
  }
  :global(.dark) .auth-viewport {
    background-color: #121310;
    color: #f4f4ee;
  }
</style>

<div class="auth-viewport relative min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 transition-colors duration-500 overflow-x-hidden font-sans">
  <LineArtBackground />

  <header class="fixed top-5 left-0 right-0 px-6 flex items-center justify-between z-20 pointer-events-none">
    <div class="pointer-events-auto select-none">
      <a href="/login" class="flex items-center gap-2 group">
        <img src="/logo-wordmark.webp" alt="Materio" class="h-6 w-auto object-contain opacity-85 group-hover:opacity-100 transition-opacity" />
      </a>
    </div>
    <div class="pointer-events-auto flex items-center gap-2">
      <ThemeToggle />
    </div>
  </header>

  <main class="relative z-10 w-full flex items-center justify-center my-auto pt-12 pb-6">
    <AuthCard maxWidth="max-w-[440px]">
      <div class="flex flex-col justify-center items-center py-8 space-y-4 text-center">
        <BudLogo class="w-16 h-16 text-foreground" />
        <div class="w-7 h-7 border-2 border-[#5b6f00] dark:border-[#7a940c] border-t-transparent rounded-full animate-spin mt-2"></div>
        <div class="space-y-1">
          <h2 class="text-xl font-serif text-foreground">Completing sign in...</h2>
          <p class="text-xs text-muted-foreground">Redirecting you to your account.</p>
        </div>
      </div>
    </AuthCard>
  </main>
</div>
