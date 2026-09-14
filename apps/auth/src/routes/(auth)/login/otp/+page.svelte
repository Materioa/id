<script lang="ts">
  import { goto } from '$app/navigation';
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import { ShieldAlertIcon } from '@hugeicons/core-free-icons';
  
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
      
      goto('/overview');
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      isLoading = false;
    }
  }

  function handleOtpInput(e: Event, index: number) {
    const input = e.target as HTMLInputElement;
    const val = input.value;
    
    // Allow only numbers
    if (!/^\d*$/.test(val)) {
      otpArray[index] = '';
      return;
    }
    
    otpArray[index] = val;
    
    // Move to next input
    if (val && index < 5) {
      otpInputs[index + 1]?.focus();
    }
  }

  function handleOtpKeydown(e: KeyboardEvent, index: number) {
    if (e.key === 'Backspace' && !otpArray[index] && index > 0) {
      otpInputs[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: ClipboardEvent) {
    e.preventDefault();
    const pastedData = e.clipboardData?.getData('text/plain')?.trim();
    if (!pastedData || !/^\d+$/.test(pastedData)) return;

    for (let i = 0; i < Math.min(6, pastedData.length); i++) {
      otpArray[i] = pastedData[i];
    }
    
    const nextFocusIndex = Math.min(5, pastedData.length);
    otpInputs[nextFocusIndex]?.focus();
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
          href="mailto:support@getmaterio.app?subject={encodeURIComponent('Account Suspension Appeal - ' + email)}&body={encodeURIComponent('Hello Materio Team,\n\nMy account (' + email + ') has been suspended for:\n' + suspensionReason + '\n\nI believe this was a mistake because:\n[Please explain why your account should be reinstated]\n\nThank you.')}"
          class="btn-base btn-primary"
        >
          File an Appeal
        </a>
        <button
          type="button"
          onclick={resetOtpLogin}
          class="btn-base btn-secondary"
        >
          Sign Out
        </button>
      </div>
    </div>
  </div>
{:else}
<div class="min-h-screen w-full bg-background flex flex-col items-center pt-[10vh] px-4 font-sans relative pb-10">
  <!-- Top Left Logo -->
  <div class="absolute top-6 left-6 flex items-center gap-2 select-none cursor-pointer" onclick={() => goto('/login')}>
    <img src="/logo-wordmark.webp" alt="Materio" class="h-6 object-contain" />
  </div>

  <div class="w-full max-w-sm mt-12 mb-8 text-center">
    <h1 class="text-3xl font-bold text-foreground mb-3 tracking-tight">Login with Email</h1>
    <p class="text-muted-foreground text-[15px]">
      {step === 'email' ? 'Enter your email to receive a verification code.' : 'Enter the 6-digit code sent to your email.'}
    </p>
  </div>

  <div class="w-full max-w-[360px]">
    {#if errorMsg}
      <div class="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg text-center font-medium">
        {errorMsg}
      </div>
    {/if}

    {#if successMsg && step === 'otp'}
      <div class="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm rounded-lg text-center font-medium">
        {successMsg}
      </div>
    {/if}

    {#if step === 'email'}
      <form onsubmit={handleSendOtp} class="space-y-4">
        <div class="space-y-1">
          <input 
            id="email"
            type="email" 
            bind:value={email}
            required
            placeholder="Email address"
            class="w-full bg-transparent border border-border/80 text-foreground placeholder:text-muted-foreground px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all rounded-md text-[15px]"
          />
        </div>

        <button 
          type="submit" 
          disabled={isLoading}
          class="btn-base btn-primary w-full py-3.5 mt-4"
        >
          {isLoading ? 'Sending...' : 'Send Verification Code'}
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
              class="w-12 h-14 bg-transparent border border-border/80 text-foreground text-center text-xl font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all rounded-xl shadow-sm border-b-[3px]"
            />
          {/each}
        </div>

        <button 
          type="submit" 
          disabled={isLoading}
          class="btn-base btn-primary w-full py-3.5 mt-4"
        >
          {isLoading ? 'Verifying...' : 'Sign In'}
        </button>
        
        <div class="text-center mt-4">
          <button 
            type="button" 
            class="text-sm text-primary hover:underline"
            onclick={() => { step = 'email'; errorMsg = ''; }}
          >
            Use a different email
          </button>
        </div>
      </form>
    {/if}

    <div class="my-8 relative flex items-center justify-center">
      <div class="absolute inset-0 flex items-center">
        <div class="w-full border-t border-border/60"></div>
      </div>
      <span class="relative bg-background px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Or</span>
    </div>

    <div class="space-y-3">
      <a 
        href="/login"
        class="w-full flex items-center justify-center gap-3 bg-transparent border border-border hover:bg-muted/50 py-3 rounded-md text-foreground transition-colors text-[15px] font-medium"
      >
        <span>Back to Password Login</span>
      </a>
    </div>
  </div>
</div>
{/if}
