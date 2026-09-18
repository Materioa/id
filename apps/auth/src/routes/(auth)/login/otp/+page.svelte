<svelte:head>
  <title>Login with Email - Materio ID</title>
</svelte:head>

<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { getAppUrls } from '@materio/config';
  import AuthCard from '$lib/components/AuthCard.svelte';
  import LineArtBackground from '$lib/components/LineArtBackground.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import BudLogo from '$lib/components/BudLogo.svelte';
  import { ShieldAlert, ArrowLeft } from 'lucide-svelte';
  
  let email = $state('');
  let otpCode = $state('');
  let otpArray = $state(['', '', '', '', '', '']);
  let otpInputs: HTMLInputElement[] = [];
  let step = $state<'email' | 'otp'>('email');
  
  let isLoading = $state(false);
  let errorMsg = $state('');
  let successMsg = $state('');

  // Suspension states
  let isSuspended = $state(false);
  let suspensionReason = $state('');

  function resetOtpLogin() {
    isSuspended = false;
    suspensionReason = '';
    otpCode = '';
    otpArray = ['', '', '', '', '', ''];
    step = 'email';
    errorMsg = '';
  }
  
  async function handleSendOtp(e: Event) {
    e.preventDefault();
    isLoading = true;
    errorMsg = '';

    try {
      const res = await fetch('/api/v2/login/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json() as any;
      
      if (!res.ok) {
        if (data.suspended) {
          isSuspended = true;
          suspensionReason = data.banReason || 'Violation of platform terms and conditions';
          return;
        }
        throw new Error(data.error || 'Failed to send OTP');
      }

      step = 'otp';
      successMsg = 'A verification code has been sent to your email.';
      setTimeout(() => otpInputs[0]?.focus(), 50);
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      isLoading = false;
    }
  }

  async function handleVerifyOtp(e: Event) {
    e.preventDefault();
    otpCode = otpArray.join('');
    
    if (otpCode.length !== 6) {
      errorMsg = 'Please enter all 6 digits';
      return;
    }
    
    isLoading = true;
    errorMsg = '';
    successMsg = '';

    try {
      const res = await fetch('/api/v2/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: email, 
          otp: otpCode,
          method: 'otp'
        })
      });

      const data = await res.json() as any;
      
      if (!res.ok) {
        if (data.suspended) {
          isSuspended = true;
          suspensionReason = data.banReason || 'Violation of terms of service';
          return;
        }
        throw new Error(data.error || 'Invalid OTP');
      }

      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      
      const callback = $page.url.searchParams.get('callback');
      if (callback) {
        try {
          const cbUrl = new URL(callback);
          if (data.handoffCode) cbUrl.searchParams.set('code', data.handoffCode);
          window.location.href = cbUrl.toString();
          return;
        } catch {}
      }
      const appUrls = getAppUrls(typeof window !== 'undefined' ? window.location.origin : undefined);
      window.location.href = `${appUrls.accounts}/overview`;
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      isLoading = false;
    }
  }

  function handleOtpInput(e: Event, index: number) {
    const input = e.target as HTMLInputElement;
    const value = input.value;
    
    if (value.length > 0) {
      otpArray[index] = value[value.length - 1];
      if (index < 5 && otpInputs[index + 1]) {
        otpInputs[index + 1].focus();
      }
    }
  }

  function handleOtpKeydown(e: KeyboardEvent, index: number) {
    if (e.key === 'Backspace' && !otpArray[index] && index > 0) {
      otpInputs[index - 1].focus();
    }
  }

  function handleOtpPaste(e: ClipboardEvent) {
    e.preventDefault();
    const pastedData = e.clipboardData?.getData('text').trim() || '';
    if (/^\d{6}$/.test(pastedData)) {
      for (let i = 0; i < 6; i++) {
        otpArray[i] = pastedData[i];
      }
      otpInputs[5]?.focus();
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
</style>

<div class="auth-viewport relative min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 transition-colors duration-500 overflow-x-hidden font-sans">
  
  <LineArtBackground />

  <!-- Top Navigation Controls -->
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

  <!-- Centered Card -->
  <main class="relative z-10 w-full flex items-center justify-center my-auto pt-12 pb-6">
    <AuthCard maxWidth="max-w-[460px]">
      {#if isSuspended}
        <div class="text-center space-y-5">
          <div class="mx-auto w-12 h-12 text-destructive flex items-center justify-center bg-destructive/10 rounded-full">
            <ShieldAlert class="w-6 h-6" />
          </div>

          <div class="space-y-2">
            <h1 class="text-2xl font-serif font-normal tracking-tight text-foreground">
              Materio ID Suspended
            </h1>
            <p class="text-sm text-muted-foreground leading-relaxed">
              Your account has been suspended for <span class="font-medium text-foreground">{suspensionReason}</span>.
            </p>
          </div>

          <div class="flex items-center justify-center gap-3 pt-3">
            <button
              type="button"
              onclick={resetOtpLogin}
              class="px-5 py-2.5 rounded-full bg-black/5 dark:bg-white/10 text-foreground text-xs sm:text-sm font-medium hover:bg-black/10 dark:hover:bg-white/15 transition-colors cursor-pointer"
            >
              Back to Login
            </button>
          </div>
        </div>

      {:else}
        <!-- Card Header with BudLogo -->
        <div class="flex flex-col items-center text-center">
          <div class="w-16 h-16 flex items-center justify-center text-foreground mb-4 select-none">
            <BudLogo class="w-16 h-16 text-foreground" />
          </div>

          <h1 class="text-3xl font-serif font-normal text-foreground tracking-tight mb-2">
            Sign In with Email
          </h1>
          <p class="text-muted-foreground text-[14px] leading-snug mb-7 max-w-[320px]">
            {step === 'email' ? 'Enter your email to receive a verification code.' : 'Enter the 6-digit code sent to your email.'}
          </p>
        </div>

        {#if errorMsg}
          <div class="mb-5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs sm:text-sm text-center font-medium leading-relaxed animate-in fade-in duration-150">
            {errorMsg}
          </div>
        {/if}

        {#if successMsg && step === 'otp'}
          <div class="mb-5 p-3 rounded-xl bg-[#5b6f00]/10 dark:bg-[#7a940c]/20 border border-[#5b6f00]/20 text-[#5b6f00] dark:text-[#b2c248] text-xs sm:text-sm text-center font-medium leading-relaxed animate-in fade-in duration-150">
            {successMsg}
          </div>
        {/if}

        {#if step === 'email'}
          <form onsubmit={handleSendOtp} class="space-y-4">
            <input 
              id="email"
              type="email" 
              bind:value={email}
              required
              placeholder="name@company.com"
              class="w-full h-12 px-4 rounded-[14px] bg-black/[0.03] dark:bg-white/[0.05] border border-black/10 dark:border-white/15 focus:border-[#7a940c] text-foreground placeholder:text-muted-foreground text-[14px] outline-none ring-2 ring-transparent focus:ring-[#7a940c]/25 transition-all font-sans"
            />

            <button 
              type="submit" 
              disabled={isLoading}
              class="w-full h-12 rounded-[14px] bg-[#5b6f00] dark:bg-[#7a940c] hover:bg-[#4c5c00] dark:hover:bg-[#8ba80e] text-white font-medium text-[14px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-60"
            >
              {#if isLoading}
                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Sending Code...</span>
              {:else}
                <span>Send Verification Code</span>
              {/if}
            </button>
          </form>
        {:else}
          <form onsubmit={handleVerifyOtp} class="space-y-4">
            <div class="flex items-center justify-center gap-2">
              {#each otpArray as digit, i}
                <input 
                  type="text" 
                  bind:value={otpArray[i]}
                  bind:this={otpInputs[i]}
                  oninput={(e) => handleOtpInput(e, i)}
                  onkeydown={(e) => handleOtpKeydown(e, i)}
                  onpaste={handleOtpPaste}
                  required
                  maxlength="1"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  class="w-11 h-13 rounded-[12px] bg-black/[0.03] dark:bg-white/[0.05] border border-black/10 dark:border-white/15 focus:border-[#7a940c] text-foreground text-center text-xl font-mono outline-none ring-2 ring-transparent focus:ring-[#7a940c]/25 transition-all"
                />
              {/each}
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              class="w-full h-12 rounded-[14px] bg-[#5b6f00] dark:bg-[#7a940c] hover:bg-[#4c5c00] dark:hover:bg-[#8ba80e] text-white font-medium text-[14px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-60"
            >
              {#if isLoading}
                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Signing In...</span>
              {:else}
                <span>Sign In</span>
              {/if}
            </button>
            
            <div class="text-center pt-1">
              <button 
                type="button" 
                class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                onclick={() => { step = 'email'; errorMsg = ''; }}
              >
                Use a different email
              </button>
            </div>
          </form>
        {/if}

        <div class="mt-6 pt-5 border-t border-black/[0.06] dark:border-white/[0.07] text-center">
          <a 
            href="/login"
            class="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
          >
            <ArrowLeft class="w-3.5 h-3.5" />
            <span>Back to Materio ID Login</span>
          </a>
        </div>
      {/if}
    </AuthCard>
  </main>
</div>
