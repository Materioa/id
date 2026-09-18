<svelte:head>
  <title>Sign In - Materio ID</title>
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { getAppUrls, setClientCookie, getClientCookie, clearClientCookie } from '@materio/config';
  import Checkbox from '$lib/components/Checkbox.svelte';
  import AuthCard from '$lib/components/AuthCard.svelte';
  import LineArtBackground from '$lib/components/LineArtBackground.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import BudLogo from '$lib/components/BudLogo.svelte';
  import { Eye, EyeOff, ArrowLeft, ShieldAlert } from 'lucide-svelte';

  // Step state: 'options' | 'sso_identity' | 'password' | '2fa'
  let step = $state<'options' | 'sso_identity' | 'password' | '2fa'>('options');
  
  let identity = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let remember = $state(false);
  let isLoading = $state(false);

  // Targeted error state per option (rendered inline underneath, no cards/icons)
  let errors = $state<{
    materio?: string;
    google?: string;
    github?: string;
    identity?: string;
    password?: string;
    '2fa'?: string;
    otp?: string;
    general?: string;
  }>({});

  function clearErrors() {
    errors = {};
  }

  // 'Last used' provider state ('materio' | 'google' | 'github')
  let lastUsedProvider = $state<string>('materio');

  // 2FA state
  let requires2fa = $state(false);
  let tempToken = $state('');
  let otpCode = $state('');

  // Suspension states
  let isSuspended = $state(false);
  let suspensionReason = $state('');
  let suspendedIdentity = $state('');

  let emailInputRef = $state<HTMLInputElement | null>(null);
  let passwordInputRef = $state<HTMLInputElement | null>(null);
  let otpInputRef = $state<HTMLInputElement | null>(null);

  onMount(async () => {
    const stored = localStorage.getItem('last_auth_provider');
    if (stored) {
      lastUsedProvider = stored;
    }

    // Check for query errors (e.g. from OAuth callbacks)
    const err = $page.url.searchParams.get('error');
    const providerParam = $page.url.searchParams.get('provider') || '';
    if (err) {
      let message = err;
      if (err === 'domain_restricted') {
        const blocked = $page.url.searchParams.get('blocked_email');
        message = blocked
          ? `This domain (${blocked}) is not configured for SSO. Please use a different sign in option.`
          : 'This domain is not configured for SSO. Please use a different sign in option.';
      }

      if (providerParam === 'google') {
        errors.google = message;
      } else if (providerParam === 'github') {
        errors.github = message;
      } else if (providerParam === 'materio') {
        errors.materio = message;
      } else {
        if (lastUsedProvider === 'google') errors.google = message;
        else if (lastUsedProvider === 'github') errors.github = message;
        else errors.materio = message;
      }
      return;
    }

    // Silent SSO: If already authenticated and no explicit prompt to re-enter, auto-redirect
    const prompt = $page.url.searchParams.get('prompt');
    const existingToken = getClientCookie('materio_token') || localStorage.getItem('token');
    if (existingToken && prompt !== 'select_account' && prompt !== 'login') {
      try {
        const res = await fetch('/api/v2/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${existingToken}`
          },
          body: JSON.stringify({ action: 'create' })
        });
        if (res.ok) {
          const data = await res.json() as any;
          if (data.handoffCode) {
            redirectToDestination(data.handoffCode);
            return;
          }
        } else {
          // Stale or revoked token: clean up so user can cleanly re-authenticate
          localStorage.removeItem('token');
          clearClientCookie('materio_token');
        }
      } catch (e) {
        // Fall through to display login form
      }
    }
  });

  function setLastUsed(provider: string) {
    lastUsedProvider = provider;
    try {
      localStorage.setItem('last_auth_provider', provider);
    } catch {}
  }

  // Focus input when step changes
  $effect(() => {
    if (step === 'sso_identity' && emailInputRef) {
      setTimeout(() => emailInputRef?.focus(), 50);
    } else if (step === 'password' && passwordInputRef) {
      setTimeout(() => passwordInputRef?.focus(), 50);
    } else if (step === '2fa' && otpInputRef) {
      setTimeout(() => otpInputRef?.focus(), 50);
    }
  });

  function resetLogin() {
    isSuspended = false;
    suspensionReason = '';
    suspendedIdentity = '';
    password = '';
    identity = '';
    requires2fa = false;
    clearErrors();
    step = 'options';
  }

  function handleStartSso() {
    setLastUsed('materio');
    clearErrors();
    step = 'sso_identity';
  }

  function handleContinueIdentity(e?: Event) {
    if (e) e.preventDefault();
    clearErrors();
    if (!identity.trim()) {
      errors.identity = 'Please enter your email address or username.';
      return;
    }
    step = 'password';
  }

  async function handleLogin(e: Event) {
    e.preventDefault();
    isLoading = true;
    clearErrors();

    try {
      const res = await fetch('/api/v2/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: identity.trim(), password })
      });

      const data = (await res.json()) as any;

      if (!res.ok) {
        if (data.suspended) {
          isSuspended = true;
          suspensionReason = data.banReason || 'Violation of terms of service';
          suspendedIdentity = identity;
          return;
        }
        throw new Error(data.error || 'Incorrect password or login failed.');
      }

      if (data.requires_2fa) {
        requires2fa = true;
        tempToken = data.tempToken;
        step = '2fa';
        return;
      }

      if (data.token) {
        localStorage.setItem('token', data.token);
        setClientCookie('materio_token', data.token);
      }

      redirectToDestination(data.handoffCode);
    } catch (e: any) {
      errors.password = e.message || 'Incorrect password. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  async function handleVerify2FA(e: Event) {
    e.preventDefault();
    isLoading = true;
    clearErrors();

    try {
      const res = await fetch('/api/v2/login/verify-2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tempToken}`
        },
        body: JSON.stringify({ code: otpCode.trim() })
      });

      const data = (await res.json()) as any;

      if (!res.ok) {
        if (data.suspended) {
          isSuspended = true;
          suspensionReason = data.banReason || 'Violation of terms of service';
          suspendedIdentity = identity;
          return;
        }
        throw new Error(data.error || 'Invalid 2FA code. Please try again.');
      }

      if (data.token) {
        localStorage.setItem('token', data.token);
        setClientCookie('materio_token', data.token);
      }

      redirectToDestination(data.handoffCode);
    } catch (e: any) {
      errors['2fa'] = e.message || 'Invalid 2FA code. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  function handleOAuthLogin(provider: 'google' | 'github') {
    setLastUsed(provider);
    clearErrors();
    
    const callback = $page.url.searchParams.get('callback');
    const targetUrl = new URL(`/api/v2/oauth/${provider}`, window.location.origin);
    if (callback) {
      targetUrl.searchParams.set('callback', callback);
    }
    
    window.location.href = targetUrl.toString();
  }

  function redirectToDestination(handoffCode?: string) {
    const callback = $page.url.searchParams.get('callback');
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
      } catch {
        // Fall back to accounts app overview
      }
    }
    const appUrls = getAppUrls(typeof window !== 'undefined' ? window.location.origin : undefined);
    if (handoffCode) {
      window.location.href = `${appUrls.accounts}/auth/callback?code=${handoffCode}`;
    } else {
      window.location.href = `${appUrls.accounts}/overview`;
    }
  }

  function handleOtpLogin() {
    clearErrors();
    const callback = $page.url.searchParams.get('callback');
    if (callback) {
      goto(`/login/otp?callback=${encodeURIComponent(callback)}`);
    } else {
      goto('/login/otp');
    }
  }
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

  .auth-button-base {
    background-color: rgba(0, 0, 0, 0.03);
    border-color: rgba(0, 0, 0, 0.1);
    color: #0e0f0c;
  }
  .auth-button-base:hover {
    background-color: rgba(0, 0, 0, 0.06);
    border-color: rgba(0, 0, 0, 0.2);
  }
  :global(.dark) .auth-button-base {
    background-color: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
    color: #f4f4ee;
  }
  :global(.dark) .auth-button-base:hover {
    background-color: rgba(255, 255, 255, 0.09);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .auth-input {
    background-color: rgba(0, 0, 0, 0.03);
    border-color: rgba(0, 0, 0, 0.12);
    color: #0e0f0c;
  }
  :global(.dark) .auth-input {
    background-color: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.15);
    color: #f4f4ee;
  }

  .identity-pill {
    background-color: rgba(0, 0, 0, 0.03);
    border-color: rgba(0, 0, 0, 0.07);
  }
  :global(.dark) .identity-pill {
    background-color: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
  }
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

  <!-- Centered Framed Card Container -->
  <main class="relative z-10 w-full flex items-center justify-center my-auto pt-20 pb-6">
    <AuthCard maxWidth="max-w-[460px]">
      
      {#if isSuspended}
        <!-- Account Suspended View -->
        <div class="text-center space-y-5">
          <div class="mx-auto w-12 h-12 text-destructive flex items-center justify-center bg-destructive/10 rounded-full">
            <ShieldAlert class="w-6 h-6" />
          </div>

          <div class="space-y-2">
            <h1 class="text-2xl font-serif font-normal tracking-tight text-foreground">
              Materio ID Suspended
            </h1>
            <p class="text-sm text-muted-foreground leading-relaxed">
              Your Materio ID has been suspended for <span class="font-medium text-foreground">{suspensionReason}</span> and thereby access has been revoked.
            </p>
          </div>

          <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
            <a 
              href="mailto:help@getmaterio.app" 
              class="w-full sm:w-auto px-5 py-2.5 rounded-full bg-[#5b6f00] dark:bg-[#7a940c] text-white text-xs sm:text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Contact Support
            </a>
            <button 
              type="button" 
              onclick={resetLogin} 
              class="w-full sm:w-auto px-5 py-2.5 rounded-full bg-black/5 dark:bg-white/10 text-foreground text-xs sm:text-sm font-medium hover:bg-black/10 dark:hover:bg-white/15 transition-colors cursor-pointer"
            >
              Sign out / Switch
            </button>
          </div>
        </div>

      {:else}
        
        <!-- Animated Bud Logo Brand Header -->
        <div class="flex justify-center mb-6">
          <BudLogo class="w-16 h-16 text-foreground" />
        </div>

        <!-- Section Header -->
        <div class="text-center mb-6">
          <h1 class="text-3xl sm:text-[34px] font-serif font-normal text-foreground tracking-tight leading-tight mb-2">
            Welcome to Materio
          </h1>
          <p class="text-sm text-muted-foreground">
            {#if step === 'password'}
              Enter your password to sign in.
            {:else if step === '2fa'}
              Two-factor authentication required.
            {:else if step === 'sso_identity'}
              Enter your Materio ID username or email.
            {:else}
              Choose how you'd like to <span class="font-semibold text-foreground">continue</span>.
            {/if}
          </p>
        </div>

        <!-- General / Uncategorized Inline Error -->
        {#if errors.general}
          <p class="text-[13px] text-[#e95d3d] dark:text-[#ff6b4a] pb-3 text-center leading-snug font-normal animate-in fade-in duration-150">
            {errors.general}
          </p>
        {/if}

        <!-- STEP: SSO IDENTITY -->
        {#if step === 'sso_identity'}
          <form onsubmit={handleContinueIdentity} class="space-y-3 pt-1 animate-in fade-in duration-200">
            <div>
              <input 
                bind:this={emailInputRef}
                type="text" 
                bind:value={identity}
                oninput={() => errors.identity = ''}
                required
                placeholder="Email or username"
                class="auth-input w-full h-12 px-4 rounded-[14px] border text-foreground placeholder:text-muted-foreground text-[14px] outline-none ring-2 ring-[#7a940c]/25 dark:ring-[#8aa70e]/30 border-[#7a940c]/60 dark:border-[#8aa70e]/80 transition-all font-sans"
              />
              {#if errors.identity}
                <p class="text-[13px] text-[#e95d3d] dark:text-[#ff6b4a] pt-1.5 px-1 leading-snug font-normal animate-in fade-in duration-150">
                  {errors.identity}
                </p>
              {/if}
            </div>

            <button 
              type="submit"
              class="w-full h-12 rounded-[14px] bg-[#5b6f00] dark:bg-[#7a940c] hover:bg-[#4c5c00] dark:hover:bg-[#8ba80e] text-white font-medium text-[14px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
            >
              <span>Continue with Materio ID</span>
            </button>

            <div class="flex flex-col items-center gap-3 pt-3">
              <button 
                type="button" 
                onclick={handleOtpLogin}
                class="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline cursor-pointer"
              >
                Prefer to sign in with an email code?
              </button>
              {#if errors.otp}
                <p class="text-[13px] text-[#e95d3d] dark:text-[#ff6b4a] pt-0.5 px-1 text-center leading-snug font-normal animate-in fade-in duration-150">
                  {errors.otp}
                </p>
              {/if}

              <button 
                type="button" 
                onclick={() => { step = 'options'; clearErrors(); }}
                class="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft class="w-3.5 h-3.5" />
                <span>Back to all options</span>
              </button>
            </div>
          </form>

        <!-- STEP: INITIAL OPTIONS LIST -->
        {:else if step === 'options'}
          <div class="space-y-3">
            
            <!-- 1. SIGN IN WITH MATERIO ID -->
            <div>
              <div class="relative">
                <button 
                  type="button" 
                  onclick={handleStartSso}
                  class="auth-button-base w-full h-12 rounded-[14px] border font-medium text-[14px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  <span>Sign in with Materio ID</span>
                </button>

                {#if lastUsedProvider === 'materio'}
                  <span class="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide bg-[#5b6f00] text-white dark:bg-[#7a940c] shadow-xs pointer-events-none select-none">
                    Last used
                  </span>
                {/if}
              </div>

              {#if errors.materio}
                <p class="text-[13px] text-[#e95d3d] dark:text-[#ff6b4a] pt-1.5 px-1 leading-snug font-normal animate-in fade-in duration-150">
                  {errors.materio}
                </p>
              {/if}
            </div>

            <!-- 2. SIGN IN WITH GOOGLE -->
            <div>
              <div class="relative">
                <button 
                  type="button" 
                  onclick={() => handleOAuthLogin('google')}
                  class="auth-button-base w-full h-12 rounded-[14px] border font-medium text-[14px] flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Sign in with Google</span>
                </button>

                {#if lastUsedProvider === 'google'}
                  <span class="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide bg-[#5b6f00] text-white dark:bg-[#7a940c] shadow-xs pointer-events-none select-none">
                    Last used
                  </span>
                {/if}
              </div>

              {#if errors.google}
                <p class="text-[13px] text-[#e95d3d] dark:text-[#ff6b4a] pt-1.5 px-1 leading-snug font-normal animate-in fade-in duration-150">
                  {errors.google}
                </p>
              {/if}
            </div>

            <!-- 3. SIGN IN WITH GITHUB -->
            <div>
              <div class="relative">
                <button 
                  type="button" 
                  onclick={() => handleOAuthLogin('github')}
                  class="auth-button-base w-full h-12 rounded-[14px] border font-medium text-[14px] flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  <svg class="w-4 h-4 shrink-0 fill-current text-foreground" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  <span>Sign in with GitHub</span>
                </button>

                {#if lastUsedProvider === 'github'}
                  <span class="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide bg-[#5b6f00] text-white dark:bg-[#7a940c] shadow-xs pointer-events-none select-none">
                    Last used
                  </span>
                {/if}
              </div>

              {#if errors.github}
                <p class="text-[13px] text-[#e95d3d] dark:text-[#ff6b4a] pt-1.5 px-1 leading-snug font-normal animate-in fade-in duration-150">
                  {errors.github}
                </p>
              {/if}
            </div>
          </div>

        <!-- STEP: PASSWORD STEP -->
        {:else if step === 'password'}
          <form onsubmit={handleLogin} class="space-y-4 animate-in fade-in duration-200">
            
            <!-- Selected User Identity Pill -->
            <div class="identity-pill flex items-center justify-between p-2.5 px-3.5 rounded-[12px] border text-xs">
              <div class="flex items-center gap-2 truncate pr-2">
                <span class="w-2 h-2 rounded-full bg-[#5b6f00] dark:bg-[#7a940c] shrink-0"></span>
                <span class="font-medium text-foreground truncate">{identity}</span>
              </div>
              <button 
                type="button" 
                onclick={() => { step = 'sso_identity'; clearErrors(); }}
                class="text-[#5b6f00] dark:text-[#b2c248] hover:underline font-medium shrink-0 cursor-pointer"
              >
                Change
              </button>
            </div>

            <!-- Password Input with Show/Hide -->
            <div>
              <div class="relative">
                <input 
                  bind:this={passwordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  bind:value={password}
                  oninput={() => errors.password = ''}
                  required
                  placeholder="Password"
                  class="auth-input w-full h-12 px-4 pr-11 rounded-[14px] border text-foreground placeholder:text-muted-foreground text-[14px] outline-none ring-1 ring-transparent focus:ring-2 focus:ring-[#7a940c]/20 transition-all font-sans"
                />
                <button 
                  type="button"
                  onclick={() => showPassword = !showPassword}
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {#if showPassword}
                    <EyeOff class="w-4 h-4" />
                  {:else}
                    <Eye class="w-4 h-4" />
                  {/if}
                </button>
              </div>

              {#if errors.password}
                <p class="text-[13px] text-[#e95d3d] dark:text-[#ff6b4a] pt-1.5 px-1 leading-snug font-normal animate-in fade-in duration-150">
                  {errors.password}
                </p>
              {/if}
            </div>

            <div class="flex items-center justify-between pt-1">
              <Checkbox bind:checked={remember} id="remember" label="Remember me" />
              <a 
                href={$page.url.searchParams.get('callback') ? `/forgot-password?callback=${encodeURIComponent($page.url.searchParams.get('callback')!)}` : '/forgot-password'} 
                class="text-xs text-muted-foreground hover:text-foreground transition-colors hover:underline underline-offset-4"
              >
                Forgot password?
              </a>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              class="w-full h-12 rounded-[14px] bg-[#5b6f00] dark:bg-[#7a940c] hover:bg-[#4c5c00] dark:hover:bg-[#8ba80e] text-white font-medium text-[14px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {#if isLoading}
                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Signing In...</span>
              {:else}
                <span>Sign In</span>
              {/if}
            </button>

            <div class="flex justify-center pt-1">
              <button 
                type="button" 
                onclick={() => { step = 'sso_identity'; clearErrors(); }}
                class="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft class="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            </div>
          </form>

        <!-- STEP: 2-STEP VERIFICATION -->
        {:else if step === '2fa'}
          <form onsubmit={handleVerify2FA} class="space-y-4 animate-in fade-in duration-200">
            <div class="text-center text-xs text-muted-foreground mb-1">
              Open your authenticator app and enter the 6-digit code.
            </div>

            <div>
              <input 
                bind:this={otpInputRef}
                type="text" 
                bind:value={otpCode}
                oninput={() => errors['2fa'] = ''}
                required
                placeholder="000000"
                class="auth-input w-full h-14 rounded-[14px] border text-foreground text-center tracking-[0.4em] text-2xl font-mono outline-none ring-2 ring-transparent focus:ring-[#7a940c]/25 transition-all"
                style="font-family: ui-monospace, 'Cascadia Code', 'SF Mono', 'Monaco', 'Consolas', monospace;"
                maxlength="6"
                pattern="[0-9]*"
                inputmode="numeric"
              />

              {#if errors['2fa']}
                <p class="text-[13px] text-[#e95d3d] dark:text-[#ff6b4a] pt-1.5 px-1 text-center leading-snug font-normal animate-in fade-in duration-150">
                  {errors['2fa']}
                </p>
              {/if}
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              class="w-full h-12 rounded-[14px] bg-[#5b6f00] dark:bg-[#7a940c] hover:bg-[#4c5c00] dark:hover:bg-[#8ba80e] text-white font-medium text-[14px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-60"
            >
              {#if isLoading}
                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Verifying...</span>
              {:else}
                <span>Verify Code</span>
              {/if}
            </button>

            <div class="flex justify-center pt-1">
              <button 
                type="button" 
                onclick={() => { step = 'password'; clearErrors(); }}
                class="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft class="w-3.5 h-3.5" />
                <span>Back to password</span>
              </button>
            </div>
          </form>
        {/if}

        <!-- Bottom Sign Up Link -->
        <div class="mt-6 pt-5 border-t border-black/[0.06] dark:border-white/[0.07] text-center">
          <p class="text-xs text-muted-foreground">
            Don't have a Materio ID?{' '}
            <a 
              href={$page.url.searchParams.get('callback') ? `/signup?callback=${encodeURIComponent($page.url.searchParams.get('callback')!)}` : '/signup'} 
              class="text-foreground hover:underline font-semibold"
            >
              Sign up
            </a>
          </p>
        </div>

        <!-- Terms and Privacy Footer -->
        <div class="mt-4 text-center">
          <p class="text-[11px] text-muted-foreground leading-relaxed">
            By continuing, you agree to the{' '}
            <a href="/terms" class="text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" class="text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">Privacy Policy</a>.
          </p>
        </div>

      {/if}

    </AuthCard>
  </main>
</div>
