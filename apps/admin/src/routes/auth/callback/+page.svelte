<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { userStore } from '$lib/stores/user.svelte';
  import { getAppUrls } from '@materio/config';

  let errorMsg = $state('');
  let isDenied = $state(false);

  onMount(async () => {
    const code = $page.url.searchParams.get('code');
    const appUrls = getAppUrls(window.location.origin);

    if (!code) {
      errorMsg = 'No authentication code provided.';
      setTimeout(() => {
        window.location.href = `${appUrls.auth}/login?callback=` + encodeURIComponent(window.location.origin + '/auth/callback');
      }, 2000);
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
        if (res.status === 403) {
          isDenied = true;
          errorMsg = data.error || 'Access denied: Superuser / Admin privileges required.';
          setTimeout(() => {
            window.location.href = `${appUrls.accounts}/overview`;
          }, 3500);
          return;
        }
        throw new Error(data.error || 'Failed to authenticate');
      }

      if (data.token) {
        if (data.user) {
          userStore.setUser(data.user);
          const isUserAdmin = Boolean(
            data.user.hasAdminPrivileges === true ||
            data.user.has_admin_privileges === true ||
            userStore.isAdmin
          );
          if (!isUserAdmin) {
            isDenied = true;
            userStore.logout();
            errorMsg = 'Access denied: Your account does not have admin privileges.';
            setTimeout(() => {
              window.location.href = `${appUrls.accounts}/overview`;
            }, 3500);
            return;
          }
        }
        localStorage.setItem('token', data.token);
        goto('/admin/overview');
      } else {
        throw new Error('No token received');
      }
    } catch (e: any) {
      errorMsg = e.message;
      const appUrls = getAppUrls(window.location.origin);
      setTimeout(() => {
        window.location.href = `${appUrls.auth}/login?callback=` + encodeURIComponent(window.location.origin + '/auth/callback');
      }, 3000);
    }
  });

  function returnToAccounts() {
    const appUrls = getAppUrls(window.location.origin);
    window.location.href = `${appUrls.accounts}/overview`;
  }
</script>

<div class="min-h-screen w-full flex items-center justify-center bg-background p-4">
  <div class="w-full max-w-sm text-center">
    {#if isDenied}
      <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 text-destructive mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
      </div>
      <h2 class="text-xl font-bold mb-2">Access Denied</h2>
      <p class="text-destructive text-sm font-medium mb-4">{errorMsg}</p>
      <p class="text-xs text-muted-foreground mb-6">You will be redirected back to the Accounts dashboard shortly...</p>
      <button 
        onclick={returnToAccounts}
        class="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        Go to Account Dashboard
      </button>
    {:else}
      <div class="inline-block animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
      <h2 class="text-xl font-semibold mb-2">Authenticating...</h2>
      {#if errorMsg}
        <p class="text-destructive font-medium">{errorMsg}</p>
      {:else}
        <p class="text-muted-foreground">Please wait while we verify your admin credentials.</p>
      {/if}
    {/if}
  </div>
</div>
