<svelte:head>
  <title>Sign In - Materio Account</title>
</svelte:head>

<script lang="ts">
  import { smoothCorners } from '@lisse/svelte';
  import { goto } from '$app/navigation';
  import Checkbox from '$lib/components/Checkbox.svelte';
  import { Eye, EyeOff } from 'lucide-svelte';
  
  import { page } from '$app/stores';
  import { getAppUrls } from '@materio/config';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { ShieldAlertIcon } from '@hugeicons/core-free-icons';
  
  let identity = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let remember = $state(false);
  let isLoading = $state(false);
  let errorMsg = $state('');
  
  let requires2fa = $state(false);
  let tempToken = $state('');
  let otpCode = $state('');

  // Suspension states
  let isSuspended = $state(false);
  let suspensionReason = $state('');
  let suspendedIdentity = $state('');

  function resetLogin() {
    isSuspended = false;
    suspensionReason = '';
    suspendedIdentity = '';
    password = '';
    identity = '';
    requires2fa = false;
  }
  
  async function handleLogin(e: Event) {
    e.preventDefault();
    isLoading = true;
    errorMsg = '';

    try {
      const res = await fetch('/api/v2/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: identity, password })
      });

      const data = await res.json() as any;
      
      if (!res.ok) {
        if (data.suspended) {
          isSuspended = true;
          suspensionReason = data.banReason || 'Violation of terms of service';
          suspendedIdentity = identity;
          return;
        }
        throw new Error(data.error || 'Login failed');
      }

      if (data.requires_2fa) {
        requires2fa = true;
        tempToken = data.tempToken;
        return;
      }

      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      
      redirectToDestination(data.handoffCode);
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      isLoading = false;
    }
  }

  function handleOtpLogin() {
    const callback = $page.url.searchParams.get('callback');
    if (callback) {
      goto(`/login/otp?callback=${encodeURIComponent(callback)}`);
    } else {
      goto('/login/otp');
    }
  }

  async function handleVerify2FA(e: Event) {
    e.preventDefault();
    isLoading = true;
    errorMsg = '';
    try {
      const res = await fetch('/api/v2/login/verify-2fa', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tempToken}`
        },
        body: JSON.stringify({ code: otpCode })
      });
      const data = await res.json() as any;
      if (!res.ok) {
        if (data.suspended) {
          isSuspended = true;
          suspensionReason = data.banReason || 'Violation of terms of service';
          suspendedIdentity = identity;
          return;
        }
        throw new Error(data.error || 'Verification failed');
      }
      
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      
      redirectToDestination(data.handoffCode);
    } catch(e: any) {
      errorMsg = e.message;
    } finally {
      isLoading = false;
    }
  }

  function redirectToDestination(handoffCode?: string) {
    const callback = $page.url.searchParams.get('callback');
    if (callback) {
      try {
        const cbUrl = new URL(callback);
        if (handoffCode) {
          cbUrl.searchParams.set('code', handoffCode);
        }
        window.location.href = cbUrl.toString();
        return;
      } catch {
        // Fall back to accounts app overview
      }
    }
    const appUrls = getAppUrls(typeof window !== 'undefined' ? window.location.origin : undefined);
    window.location.href = `${appUrls.accounts}/overview`;
  }
</script>

{#if isSuspended}
  <div class="h-screen w-full bg-background text-foreground flex flex-col items-center justify-center p-6 relative select-none font-sans">
    <!-- Top Left Logo -->
    <div class="absolute top-6 left-6 flex items-center">
      <img src="/logo-wordmark.webp" alt="Materio" class="h-6 object-contain" />
    </div>

    <!-- Suspension Notice -->
    <div class="max-w-md w-full text-center space-y-6 animate-in fade-in duration-200">
      <div class="mx-auto w-12 h-12 text-destructive flex items-center justify-center">
        <HugeiconsIcon icon={ShieldAlertIcon} size={36} />
      </div>

      <div class="space-y-3">
        <h1 class="text-2xl font-bold tracking-tight text-foreground">
          Account Suspended
        </h1>
        <p class="text-sm text-muted-foreground leading-relaxed">
          Your account has been suspended for <span class="font-medium text-foreground">{suspensionReason}</span> and thereby access has been revoked.
        </p>
      </div>

      <div class="flex items-center justify-center gap-3 pt-2">
        <a 
          href="mailto:support@getmaterio.app?subject={encodeURIComponent('Account Suspension Appeal - ' + suspendedIdentity)}&body={encodeURIComponent('Hello Materio Team,\n\nMy account (' + suspendedIdentity + ') has been suspended for:\n' + suspensionReason + '\n\nI believe this was a mistake because:\n[Please explain why your account should be reinstated]\n\nThank you.')}"
          class="btn-base btn-primary"
        >
          File an Appeal
        </a>
        <button
          type="button"
          onclick={resetLogin}
          class="btn-base btn-secondary"
        >
          Sign Out
        </button>
      </div>
    </div>
  </div>
{:else}
<div class="min-h-screen w-full bg-background flex flex-col items-center pt-[10vh] px-4 font-sans relative">
  <!-- Top Left Logo -->
  <div class="absolute top-6 left-6 flex items-center select-none">
    <img src="/logo-wordmark.webp" alt="Materio" class="h-6 object-contain" />
  </div>

  <div class="w-full max-w-sm mt-12 mb-8 text-center">
    <h1 class="text-3xl font-bold text-foreground mb-3 tracking-tight">Welcome to Materio</h1>
    <p class="text-muted-foreground text-[15px]">Sign in with your Materio account to continue.</p>
  </div>

  <div class="w-full max-w-[360px]">
    {#if errorMsg}
      <div class="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg text-center font-medium">
        {errorMsg}
      </div>
    {/if}

    {#if requires2fa}
      <div class="mb-4 text-center">
        <p class="text-muted-foreground text-sm">Open your authenticator app and enter the code.</p>
      </div>
      <form onsubmit={handleVerify2FA} class="space-y-4">
        <div class="space-y-1">
          <input 
            type="text" 
            bind:value={otpCode}
            required
            placeholder="6-digit Code"
            class="w-full bg-transparent border border-border/80 text-foreground placeholder:text-muted-foreground px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all rounded-md text-[15px] text-center tracking-widest text-lg font-mono"
            maxlength="6"
            pattern="[0-9]*"
            inputmode="numeric"
          />
        </div>
        <button 
          type="submit" 
          disabled={isLoading}
          class="btn-base btn-primary w-full py-3 mt-2"
        >
          {isLoading ? 'Verifying...' : 'Verify Code'}
        </button>
        <button type="button" onclick={() => requires2fa = false} class="w-full text-sm text-muted-foreground mt-2 hover:text-foreground transition-colors py-2">
          Back to login
        </button>
      </form>
    {:else}
      <form onsubmit={handleLogin} class="space-y-4">
        <div class="space-y-1">
          <input 
            id="identity"
            type="text" 
            bind:value={identity}
            required
            placeholder="Email address or Username"
            class="w-full bg-transparent border border-border/80 text-foreground placeholder:text-muted-foreground px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all rounded-md text-[15px]"
          />
        </div>

        <div class="space-y-1 relative">
          <input 
            id="password"
            type={showPassword ? "text" : "password"} 
            bind:value={password}
            required
            placeholder="Password"
            class="w-full bg-transparent border border-border/80 text-foreground placeholder:text-muted-foreground px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all rounded-md text-[15px] pr-10"
          />
          <button 
            type="button" 
            onclick={() => showPassword = !showPassword}
            class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {#if showPassword}
              <EyeOff class="w-4 h-4" />
            {:else}
              <Eye class="w-4 h-4" />
            {/if}
          </button>
        </div>

        <div class="flex items-center justify-between pt-1">
          <Checkbox bind:checked={remember} id="remember" label="Remember me" />
          <a href={$page.url.searchParams.get('callback') ? `/forgot-password?callback=${encodeURIComponent($page.url.searchParams.get('callback')!)}` : '/forgot-password'} class="text-sm text-primary hover:underline underline-offset-4">Forgot password?</a>
        </div>

        <button 
          type="submit" 
          disabled={isLoading}
          class="btn-base btn-primary w-full py-3 mt-2"
        >
          {isLoading ? 'Signing In...' : 'Continue'}
        </button>
      </form>

      <div class="mt-6">
        <p class="text-center text-sm text-muted-foreground">
          Don't have an account? <a href={$page.url.searchParams.get('callback') ? `/signup?callback=${encodeURIComponent($page.url.searchParams.get('callback')!)}` : '/signup'} class="text-primary hover:underline underline-offset-4">Sign up</a>
        </p>
      </div>

      <div class="my-8 relative flex items-center justify-center">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-border/60"></div>
        </div>
        <span class="relative bg-background px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Or</span>
      </div>

      <div class="space-y-3">
        <!-- OTP Button -->
        <button 
          type="button"
          onclick={handleOtpLogin}
          class="btn-base btn-secondary w-full py-3 justify-center"
        >
          <svg xmlns="http://www.w3.org/.svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          <span>Continue with Email (OTP)</span>
        </button>

        <!-- OAuth Buttons (Grayed out as requested) -->
        <button 
          type="button"
          disabled
          class="w-full flex items-center justify-center gap-3 bg-transparent border border-border/50 py-3 rounded-md text-muted-foreground opacity-50 cursor-not-allowed text-[15px] font-medium"
        >
          <svg class="w-[18px] h-[18px] grayscale opacity-70" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          <span>Continue with Google</span>
        </button>

        <button 
          type="button"
          disabled
          class="w-full flex items-center justify-center gap-3 bg-transparent border border-border/50 py-3 rounded-md text-muted-foreground opacity-50 cursor-not-allowed text-[15px] font-medium"
        >
          <svg class="w-[18px] h-[18px] grayscale opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
          <span>Continue with GitHub</span>
        </button>
      </div>
    {/if}
    
    <div class="mt-10 flex gap-4 justify-center text-xs text-muted-foreground">
      <a href="/terms" class="hover:text-foreground hover:underline">Terms of Use</a>
      <span class="text-border">|</span>
      <a href="/privacy" class="hover:text-foreground hover:underline">Privacy Policy</a>
    </div>
  </div>
</div>
{/if}
