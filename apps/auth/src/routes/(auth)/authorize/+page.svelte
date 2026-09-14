<svelte:head>
  <title>Authorize {clientInfo ? clientInfo.name : 'App'} - Materio Account</title>
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getAppUrls } from '@materio/config';
  import { Shield, ShieldAlert, KeyRound, Globe, Check, ChevronDown } from 'lucide-svelte';

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

    const token = localStorage.getItem('token');
    if (!token) {
      goto(`/login?callback=${encodeURIComponent(window.location.href)}`);
      return;
    }

    try {
      // Fetch user info for account dropdown
      const profileRes = await fetch("/api/v2/profile", {
        headers: { Authorization: `Bearer ${token}` },
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
    
    const token = localStorage.getItem('token');
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
        desc: 'Allow the application to verify your account\'s role and permissions.'
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

  // Favicon loading state
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
  @keyframes blink-fade {
    0%, 100% { opacity: 0.2; transform: scale(0.8); }
    50% { opacity: 1; transform: scale(1.2); }
  }
  .dot-1 { animation: blink-fade 3s ease-in-out infinite 0s; }
  .dot-2 { animation: blink-fade 3s ease-in-out infinite 0.6s; }
  .dot-3 { animation: blink-fade 3s ease-in-out infinite 1.2s; }
</style>

<div class="min-h-screen w-full bg-background flex flex-col items-center pt-[5vh] px-4 font-sans text-foreground pb-6">
  <div class="w-full max-w-[440px] mt-4">
    {#if isLoading}
      <div class="flex justify-center items-center h-48">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    {:else if errorMsg}
      <div class="bg-card border border-border/50 rounded-xl p-8 text-center shadow-sm">
        <ShieldAlert class="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 class="text-xl font-bold mb-2">Authorization Error</h2>
        <p class="text-muted-foreground text-sm mb-6">{errorMsg}</p>
        <button 
          onclick={() => {
            const appUrls = getAppUrls(typeof window !== 'undefined' ? window.location.origin : undefined);
            window.location.href = `${appUrls.accounts}/overview`;
          }}
          class="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80 transition-colors text-sm font-medium"
        >
          Return to Dashboard
        </button>
      </div>
    {:else if clientInfo}
      <!-- Animated Data Transfer Graphic -->
      <div class="flex justify-center items-center gap-6 mb-5">
        <!-- Materio Mascot -->
        <img 
          src="/mascot.svg" 
          alt="Materio" 
          class="w-12 h-12 object-contain" 
        />
        
        <!-- Blinking Dots -->
        <div class="flex gap-2 w-16 justify-center items-center">
          <div class="w-1.5 h-1.5 rounded-full bg-foreground dot-1"></div>
          <div class="w-1.5 h-1.5 rounded-full bg-foreground dot-2"></div>
          <div class="w-1.5 h-1.5 rounded-full bg-foreground dot-3"></div>
        </div>

        <!-- App Icon -->
        {#if appDomain}
          <img 
            src={appFavicons[appFaviconIdx]} 
            onerror={() => { if (appFaviconIdx < appFavicons.length - 1) appFaviconIdx++; }}
            alt="App" 
            class="w-12 h-12 object-contain rounded-[10px]" 
          />
        {:else}
          <Globe class="w-12 h-12 text-muted-foreground" />
        {/if}
      </div>
      
      <!-- Title & Subtitle -->
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold mb-1.5 tracking-tight">Authorize {clientInfo.name || 'Application'}</h1>
        <p class="text-muted-foreground text-[14px]">
          This application wants to access your Materio account.
        </p>
      </div>

      <!-- Account Selection (Dropdown Mock) -->
      {#if currentUser}
        <div class="mb-6 w-full text-left">
          <h2 class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Account</h2>
          <div class="flex items-center justify-between p-3 border border-border/50 rounded-xl bg-card hover:bg-muted/30 transition-colors cursor-pointer group">
            <div class="flex items-center gap-3">
              {#if currentUser.profilePicture}
                <img src={currentUser.profilePicture} alt="Avatar" class="w-8 h-8 rounded-full bg-muted object-cover" />
              {:else}
                <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                  {(currentUser.displayName || currentUser.username || 'U').charAt(0).toUpperCase()}
                </div>
              {/if}
              <div class="flex flex-col">
                <span class="text-[13px] font-semibold leading-tight">{currentUser.displayName || currentUser.username}</span>
                <span class="text-[11px] text-muted-foreground">{currentUser.email}</span>
              </div>
            </div>
            <ChevronDown class="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </div>
      {/if}

      <!-- Permissions Section -->
      <div class="mb-6">
        <h2 class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Permissions</h2>
        <p class="text-[13px] text-muted-foreground mb-3 leading-relaxed">
          Authorizing <span class="font-medium text-foreground">{clientInfo.name || 'this application'}</span> grants it the following access permissions to your account. Only continue if you trust this app. By continuing, you agree to Materio's <a href="https://getmaterio.app/terms" target="_blank" class="underline hover:text-foreground transition-colors">Terms</a> and <a href="https://getmaterio.app/privacy" target="_blank" class="underline hover:text-foreground transition-colors">Privacy Policy</a>.
        </p>

        <!-- Permissions Box -->
        <div class="border border-border/50 rounded-xl bg-card overflow-hidden">
          <div class="p-4 space-y-4">
            {#each permissionsList as p}
              <div class="flex items-start gap-3">
                <Check class="w-[18px] h-[18px] text-foreground mt-0.5 shrink-0" />
                <div>
                  <h3 class="text-[13px] font-semibold">{p.name}</h3>
                  <p class="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="space-y-2.5 mb-5">
        <button 
          onclick={handleAllow}
          disabled={isAuthorizing}
          class="w-full bg-foreground text-background font-medium py-2.5 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 text-[14px]"
        >
          {isAuthorizing ? 'Authorizing...' : `Authorize ${clientInfo.name || 'Application'}`}
        </button>
        
        <button 
          onclick={handleDeny}
          disabled={isAuthorizing}
          class="w-full bg-transparent text-muted-foreground font-medium py-2.5 rounded-xl hover:bg-muted/50 transition-colors disabled:opacity-50 text-[14px]"
        >
          Cancel
        </button>
      </div>
      
      <!-- Footer -->
      <div class="pt-4 border-t border-border/30 text-center">
        <p class="text-[12px] text-muted-foreground">
          Authorizing will redirect you to<br/>
          <span class="font-medium text-foreground mt-1 block truncate px-4">{redirectUri}</span>
        </p>
      </div>
    {/if}
  </div>
</div>
