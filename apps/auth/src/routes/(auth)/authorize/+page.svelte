<svelte:head>
  <title>Authorize {clientInfo ? clientInfo.name : 'Application'} - Materio ID</title>
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getAppUrls, getClientCookie, setClientCookie } from '@materio/config';
  import AuthCard from '$lib/components/AuthCard.svelte';
  import LineArtBackground from '$lib/components/LineArtBackground.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { ShieldAlert, Globe, Check } from 'lucide-svelte';

  let isLoading = $state(true);
  let isAuthorizing = $state(false);
  let errorMsg = $state('');
  
  let clientInfo = $state<any>(null);
  let currentUser = $state<any>(null);
  
  let appDomain = $state('');
  
  // OAuth params
  let clientId = $state('');
  let redirectUri = $state('');
  let responseType = $state('');
  let scope = $state('');
  let stateParam = $state('');
  let codeChallenge = $state('');
  let codeChallengeMethod = $state('');
  let resource = $state('');

  onMount(async () => {
    clientId = $page.url.searchParams.get('client_id') || '';
    redirectUri = $page.url.searchParams.get('redirect_uri') || '';
    responseType = $page.url.searchParams.get('response_type') || '';
    scope = $page.url.searchParams.get('scope') || 'profile email';
    stateParam = $page.url.searchParams.get('state') || '';
    codeChallenge = $page.url.searchParams.get('code_challenge') || '';
    codeChallengeMethod = $page.url.searchParams.get('code_challenge_method') || '';
    resource = $page.url.searchParams.get('resource') || '';

    if (!clientId || !redirectUri) {
      errorMsg = 'Invalid request: client_id and redirect_uri are required.';
      isLoading = false;
      return;
    }

    let token = localStorage.getItem('token') || getClientCookie('materio_token');
    if (token) {
      localStorage.setItem('token', token);
      setClientCookie('materio_token', token);
    } else {
      goto(`/login?callback=${encodeURIComponent(window.location.href)}`);
      return;
    }

    try {
      // Fetch user info
      const profileRes = await fetch('/api/v2/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (profileRes.ok) {
        const data = (await profileRes.json()) as any;
        currentUser = data.user;
      }

      // Fetch client info
      const res = await fetch(`/api/v2/auth?action=oauth_client_info&client_id=${clientId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = (await res.json()) as any;
      
      if (!res.ok) {
        throw new Error(data.error_description || data.error || 'Failed to fetch app details');
      }
      
      clientInfo = data;

      // Extract domain for favicon
      try {
        const parsedUrl = new URL(clientInfo.redirect_uri || redirectUri);
        if (parsedUrl.hostname && !parsedUrl.hostname.includes('localhost') && parsedUrl.hostname !== '127.0.0.1') {
          appDomain = parsedUrl.hostname;
        }
      } catch (e) {
        // Ignore parsing error
      }
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      isLoading = false;
    }
  });

  async function handleAllow() {
    isAuthorizing = true;
    errorMsg = '';
    
    const token = localStorage.getItem('token') || getClientCookie('materio_token');
    try {
      const res = await fetch('/api/v2/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'oauth_authorize',
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: responseType,
          scope,
          state: stateParam,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
          resource
        })
      });

      const data = (await res.json()) as any;
      
      if (res.ok && data.success && data.code) {
        const targetUrl = new URL(redirectUri);
        targetUrl.searchParams.set('code', data.code);
        if (data.state) targetUrl.searchParams.set('state', data.state);
        if (data.iss) targetUrl.searchParams.set('iss', data.iss);
        window.location.href = targetUrl.toString();
      } else if (res.status === 302 && data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        throw new Error(data.error_description || data.error || 'Authorization failed');
      }
    } catch (e: any) {
      errorMsg = e.message;
      isAuthorizing = false;
    }
  }

  function handleDeny() {
    try {
      const targetUrl = new URL(redirectUri);
      targetUrl.searchParams.set('error', 'access_denied');
      targetUrl.searchParams.set('error_description', 'The user denied the request');
      if (stateParam) targetUrl.searchParams.set('state', stateParam);
      window.location.href = targetUrl.toString();
    } catch (e) {
      const appUrls = getAppUrls(typeof window !== 'undefined' ? window.location.origin : undefined);
      window.location.href = `${appUrls.accounts}/overview`;
    }
  }

  const permissionsList = $derived.by(() => {
    const scopesArray = scope.split(/\s+/).filter(Boolean);
    const perms = [];
    
    const hasOpenId = scopesArray.includes('openid');
    const hasProfile = scopesArray.includes('profile');
    const hasEmail = scopesArray.includes('email');
    const hasAdmin = scopesArray.includes('admin') || scopesArray.length === 0;

    if (hasOpenId || hasProfile || hasEmail) {
      perms.push({
        name: 'Access Profile Information',
        desc: 'View your display name, username, and email address.'
      });
    }

    if (hasAdmin) {
      perms.push({
        name: 'Verify Access Level',
        desc: 'Allow the application to verify your Materio ID roles and permissions.'
      });
    }

    for (const s of scopesArray) {
      if (!['openid', 'profile', 'email', 'admin', 'offline_access'].includes(s)) {
        perms.push({
          name: `Access ${s.charAt(0).toUpperCase() + s.slice(1)} Data`,
          desc: `Read and manage resources related to the "${s}" scope.`
        });
      } else if (s === 'offline_access') {
        perms.push({
          name: 'Maintain Offline Access',
          desc: 'Keep the session active so the app can function when you are not present.'
        });
      }
    }

    return perms;
  });

  // Favicon loading
  let appFaviconIdx = $state(0);
  function getFaviconSources(domain: string) {
    if (!domain) return [];
    return [
      `https://${domain}/favicon.ico`,
      `https://${domain}/apple-touch-icon.png`,
      `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domain)}`
    ];
  }
  const appFavicons = $derived(getFaviconSources(appDomain));
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

  @keyframes pulse-dot {
    0%, 100% { opacity: 0.25; transform: scale(0.85); }
    50% { opacity: 1; transform: scale(1.15); }
  }
  .dot-1 { animation: pulse-dot 2.4s ease-in-out infinite 0s; }
  .dot-2 { animation: pulse-dot 2.4s ease-in-out infinite 0.4s; }
  .dot-3 { animation: pulse-dot 2.4s ease-in-out infinite 0.8s; }
</style>

<div class="auth-viewport relative min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 transition-colors duration-500 overflow-x-hidden font-sans">
  
  <!-- Line Art Vector Canvas in Background -->
  <LineArtBackground />

  <!-- Top Navigation Controls -->
  <header class="fixed top-5 left-0 right-0 px-6 flex items-center justify-between z-20 pointer-events-none">
    <div class="pointer-events-auto select-none">
      <a href="/" class="flex items-center gap-2 group">
        <img src="/logo-wordmark.webp" alt="Materio" class="h-6 w-auto object-contain opacity-85 group-hover:opacity-100 transition-opacity" />
      </a>
    </div>
    
    <div class="pointer-events-auto flex items-center gap-2">
      <ThemeToggle />
    </div>
  </header>

  <!-- Centered Card -->
  <main class="relative z-10 w-full flex items-center justify-center my-auto pt-14 pb-6">
    <AuthCard maxWidth="max-w-[480px]">
      {#if isLoading}
        <div class="flex flex-col justify-center items-center h-52 gap-3">
          <div class="w-7 h-7 border-2 border-[#a34914] dark:border-[#c05a1e] border-t-transparent rounded-full animate-spin"></div>
          <p class="text-xs text-muted-foreground font-medium">Loading authorization details...</p>
        </div>

      {:else if errorMsg}
        <div class="text-center py-4 space-y-4">
          <div class="mx-auto w-12 h-12 text-destructive flex items-center justify-center bg-destructive/10 rounded-full">
            <ShieldAlert class="w-6 h-6" />
          </div>
          <h2 class="text-xl font-serif font-normal text-foreground">Authorization Error</h2>
          <p class="text-xs sm:text-sm text-muted-foreground leading-relaxed px-2">{errorMsg}</p>
          <button 
            type="button"
            onclick={() => {
              const appUrls = getAppUrls(typeof window !== 'undefined' ? window.location.origin : undefined);
              window.location.href = `${appUrls.accounts}/overview`;
            }}
            class="px-5 py-2.5 rounded-full bg-black/5 dark:bg-white/10 text-foreground text-xs sm:text-sm font-medium hover:bg-black/10 dark:hover:bg-white/15 transition-colors cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>

      {:else if clientInfo}
        <!-- Data Transfer / Connection Graphic -->
        <div class="flex justify-center items-center gap-5 mb-5 pt-1">
          <!-- Materio Mascot Avatar -->
          <div class="w-13 h-13 rounded-[16px] bg-black/[0.04] dark:bg-white/[0.06] border border-black/5 dark:border-white/10 flex items-center justify-center p-2 shadow-xs">
            <img 
              src="/mascot.svg" 
              alt="Materio" 
              class="w-9 h-9 object-contain" 
            />
          </div>
          
          <!-- Animated Connection Pulsing Dots -->
          <div class="flex gap-2 justify-center items-center px-1">
            <div class="w-1.5 h-1.5 rounded-full bg-[#a34914] dark:bg-[#c05a1e] dot-1"></div>
            <div class="w-1.5 h-1.5 rounded-full bg-[#a34914] dark:bg-[#c05a1e] dot-2"></div>
            <div class="w-1.5 h-1.5 rounded-full bg-[#a34914] dark:bg-[#c05a1e] dot-3"></div>
          </div>

          <!-- Target App Icon -->
          <div class="w-13 h-13 rounded-[16px] bg-black/[0.04] dark:bg-white/[0.06] border border-black/5 dark:border-white/10 flex items-center justify-center p-2 shadow-xs">
            {#if appDomain}
              <img 
                src={appFavicons[appFaviconIdx]} 
                onerror={() => { if (appFaviconIdx < appFavicons.length - 1) appFaviconIdx++; }}
                alt="App Icon" 
                class="w-9 h-9 object-contain rounded-[10px]" 
              />
            {:else}
              <Globe class="w-7 h-7 text-muted-foreground" />
            {/if}
          </div>
        </div>

        <!-- Title & Subtitle -->
        <div class="text-center mb-6">
          <h1 class="text-2xl sm:text-[28px] font-serif font-normal text-foreground tracking-tight mb-1.5">
            Authorize {clientInfo.name || 'Application'}
          </h1>
          <p class="text-muted-foreground text-[13px] leading-relaxed">
            This application wants to connect with your Materio ID.
          </p>
        </div>

        <!-- Current User Account Inset Pill -->
        {#if currentUser}
          <div class="mb-5 w-full">
            <div class="flex items-center justify-between p-3 rounded-[14px] bg-black/[0.03] dark:bg-white/[0.05] border border-black/5 dark:border-white/10">
              <div class="flex items-center gap-3 min-w-0">
                {#if currentUser.profilePicture}
                  <img src={currentUser.profilePicture} alt="Avatar" class="w-8 h-8 rounded-full bg-muted object-cover shrink-0" />
                {:else}
                  <div class="w-8 h-8 rounded-full bg-[#a34914]/15 dark:bg-[#c05a1e]/20 text-[#a34914] dark:text-[#e18b5b] flex items-center justify-center font-bold text-xs shrink-0">
                    {(currentUser.displayName || currentUser.username || 'U').charAt(0).toUpperCase()}
                  </div>
                {/if}
                <div class="flex flex-col min-w-0">
                  <span class="text-[13px] font-semibold text-foreground truncate leading-tight">
                    {currentUser.displayName || currentUser.username}
                  </span>
                  <span class="text-[11px] text-muted-foreground truncate">
                    {currentUser.email}
                  </span>
                </div>
              </div>
              <span class="text-[11px] font-medium text-muted-foreground bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full select-none">
                Signed in
              </span>
            </div>
          </div>
        {/if}

        <!-- Permissions Section -->
        <div class="mb-6 space-y-2 text-left">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Requested Permissions</span>
          </div>

          <!-- Permissions Container -->
          <div class="rounded-[16px] bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] p-3.5 space-y-3 max-h-[190px] overflow-y-auto">
            {#each permissionsList as p}
              <div class="flex items-start gap-2.5">
                <div class="w-5 h-5 rounded-full bg-[#a34914]/10 dark:bg-[#c05a1e]/20 text-[#a34914] dark:text-[#e18b5b] flex items-center justify-center shrink-0 mt-0.5">
                  <Check class="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 class="text-[13px] font-medium text-foreground leading-snug">{p.name}</h3>
                  <p class="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{p.desc}</p>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="space-y-2.5 mb-4">
          <button 
            type="button"
            onclick={handleAllow}
            disabled={isAuthorizing}
            class="w-full h-12 rounded-[14px] bg-[#a34914] dark:bg-[#c05a1e] hover:bg-[#c05a1e] dark:hover:bg-[#a34914] text-white font-medium text-[14px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-60"
          >
            {#if isAuthorizing}
              <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Authorizing...</span>
            {:else}
              <span>Authorize {clientInfo.name || 'Application'}</span>
            {/if}
          </button>
          
          <button 
            type="button"
            onclick={handleDeny}
            disabled={isAuthorizing}
            class="w-full h-11 rounded-[14px] bg-transparent hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground font-medium text-[13px] transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
        
        <!-- Redirect Domain Notice -->
        <div class="pt-3 border-t border-black/[0.06] dark:border-white/[0.07] text-center">
          <p class="text-[11px] text-muted-foreground leading-relaxed truncate px-2">
            Authorizing will redirect you to <span class="font-medium text-foreground">{redirectUri}</span>
          </p>
        </div>
      {/if}
    </AuthCard>
  </main>
</div>
