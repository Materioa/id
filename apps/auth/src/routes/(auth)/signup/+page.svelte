<svelte:head>
  <title>Create your Materio ID</title>
</svelte:head>

<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { getAppUrls } from '@materio/config';
  import Checkbox from '$lib/components/Checkbox.svelte';
  import Dropdown from '$lib/components/Dropdown.svelte';
  import { Eye, EyeOff } from 'lucide-svelte';
  import { createAvatar } from '@dicebear/core';
  import { lorelei } from '@dicebear/collection';

  // State
  let step = $state('registration'); // 'registration' | 'verification'
  
  // Phase 1 Fields
  let username = $state('');
  let displayName = $state('');
  let branch = $state('Computer Science and Engineering');
  let currentYear = $state('');
  let passoutYear = $state('');
  let specialization = $state('');
  let email = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let confirmPassword = $state('');
  let showConfirmPassword = $state(false);
  
  // Phase 2 Fields
  let otpValues = $state(['', '', '', '', '', '']);
  let terms = $state(true);
  
  // UI State
  let isLoading = $state(false);
  let errorMsg = $state('');
  let successMsg = $state('');
  
  // Avatar logic
  let profilePicture = $state('');
  
  // Handle file upload preview
  function handleAvatarUpload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        profilePicture = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  // Avatar logic
  let randomSeed = $state('');
  
  function shuffleAvatar() {
    randomSeed = Math.random().toString(36).substring(7);
  }

  let dicebearAvatar = $derived(
    createAvatar(lorelei, {
      seed: randomSeed || displayName || username || 'User',
      size: 128,
      radius: 0,
      backgroundColor: ["FDFBF7", "F5F0E6"]
    }).toDataUri()
  );

  // Auto-calculate passout year
  $effect(() => {
    if (currentYear) {
      const year = parseInt(currentYear);
      if (!isNaN(year)) {
        const calculatedYear = new Date().getFullYear() + (4 - year);
        passoutYear = calculatedYear.toString();
      }
    }
  });

  async function handleSendOtp() {
    errorMsg = '';
    
    if (!username || !displayName || !email || !password || !currentYear || !specialization) {
      errorMsg = 'Please fill all required fields';
      return;
    }
    
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith('@paruluniversity.ac.in') && !normalizedEmail.endsWith('@getmaterio.app')) {
      errorMsg = 'Use your university email address';
      return;
    }

    if (password.length < 8) {
      errorMsg = 'Password must be at least 8 characters';
      return;
    }

    if (password !== confirmPassword) {
      errorMsg = 'Passwords do not match';
      return;
    }

    isLoading = true;
    
    try {
      const res = await fetch('/api/v2/auth?action=otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, type: 'signup' })
      });

      const data = await res.json() as any;
      
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to send OTP. Try again.');
      }

      step = 'verification';
      successMsg = 'Code sent to your university email!';
    } catch (e: any) {
      errorMsg = e.message || 'Connection error. Check your internet.';
    } finally {
      isLoading = false;
    }
  }

  async function handleResendOtp() {
    try {
      successMsg = '';
      const res = await fetch('/api/v2/auth?action=otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), type: 'signup' })
      });
      if (res.ok) {
        successMsg = 'New code sent!';
      }
    } catch (err) {
      // ignore
    }
  }

  function handleOtpInput(e: Event, index: number) {
    const target = e.target as HTMLInputElement;
    const val = target.value;
    
    if (!/^\d$/.test(val)) {
      target.value = '';
      otpValues[index] = '';
      return;
    }
    
    otpValues[index] = val;
    
    // Auto advance
    if (val && index < 5) {
      const nextInput = document.querySelector(`input[data-index="${index + 1}"]`) as HTMLInputElement;
      if (nextInput) nextInput.focus();
    }
  }
  
  function handleOtpKeydown(e: KeyboardEvent, index: number) {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      const prevInput = document.querySelector(`input[data-index="${index - 1}"]`) as HTMLInputElement;
      if (prevInput) prevInput.focus();
    }
  }

  function handleOtpPaste(e: ClipboardEvent) {
    e.preventDefault();
    const data = e.clipboardData?.getData('text').slice(0, 6);
    if (!data || !/^\d+$/.test(data)) return;

    data.split('').forEach((char, i) => {
      if (i < 6) {
        otpValues[i] = char;
        const input = document.querySelector(`input[data-index="${i}"]`) as HTMLInputElement;
        if (input) input.value = char;
      }
    });
    
    const nextIndex = Math.min(data.length, 5);
    const nextInput = document.querySelector(`input[data-index="${nextIndex}"]`) as HTMLInputElement;
    if (nextInput) nextInput.focus();
  }

  async function handleFinalSignup(e: Event) {
    e.preventDefault();
    
    const otpCode = otpValues.join('');
    if (otpCode.length < 6) {
      errorMsg = 'Please enter 6-digit code';
      return;
    }

    if (!terms) {
      errorMsg = 'You must agree to the Terms & Privacy';
      return;
    }

    isLoading = true;
    errorMsg = '';
    successMsg = '';

    try {
      const res = await fetch('/api/v2/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username,
          displayName,
          email: email.trim().toLowerCase(), 
          password,
          branch,
          currentYear: parseInt(currentYear),
          passoutYear: parseInt(passoutYear),
          specialization,
          otp: otpCode,
          profilePicture: profilePicture || ''
        })
      });

      const data = await res.json() as any;
      
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed. Check details.');
      }

      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      if (data.user) {
        localStorage.setItem('materio_user', JSON.stringify(data.user));
      }
      
      successMsg = 'Welcome to Materio! Redirecting...';
      setTimeout(() => {
        const callback = $page.url.searchParams.get('callback');
        if (callback) {
          try {
            const cbUrl = new URL(callback);
            if (data.handoffCode) {
              cbUrl.searchParams.set('code', data.handoffCode);
            }
            window.location.href = cbUrl.toString();
            return;
          } catch {}
        }
        const appUrls = getAppUrls(typeof window !== 'undefined' ? window.location.origin : undefined);
        window.location.href = `${appUrls.accounts}/overview`;
      }, 1500);
    } catch (e: any) {
      errorMsg = e.message;
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="h-screen w-full bg-background flex flex-col lg:flex-row overflow-hidden font-sans">
  
  <!-- Left Illustration (Desktop Only) -->
  <div class="hidden lg:block h-full aspect-[9/16] relative">
    <div class="w-full h-full overflow-hidden bg-[#fbfbfb] relative">
      <img 
        src="/c955d23e-40bc-48fe-b5f4-99901fdfb3fb.webp" 
        alt="Join Materio" 
        class="w-full h-full object-cover" 
      />
    </div>
  </div>

  <!-- Right Form Side -->
  <div class="flex-1 flex flex-col items-center pt-8 lg:pt-12 px-6 overflow-y-auto hide-scrollbar pb-10">
    <div class="w-full max-w-[440px]">
      
      <!-- Logo -->
      <div class="mb-6 lg:mb-8">
        <img src="/logo-wordmark.webp" alt="Materio" class="h-7 object-contain" />
      </div>

      <div class="mb-8">
        <h1 class="text-2xl lg:text-[28px] font-bold text-foreground mb-2 leading-tight">Create a Materio ID</h1>
        <p class="text-muted-foreground text-[15px]">Complete your registration.</p>
      </div>

      {#if errorMsg}
        <div class="mb-6 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg text-center font-medium">
          {errorMsg}
        </div>
      {/if}
      {#if successMsg}
        <div class="mb-6 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm rounded-lg text-center font-medium">
          {successMsg}
        </div>
      {/if}

      {#if step === 'registration'}
        <!-- STEP 1: Registration Data -->
        <div class="space-y-6">
          
          <!-- Identity Group -->
          <div class="flex flex-col sm:flex-row gap-6">
            <!-- Avatar Column -->
            <div class="flex flex-col items-center gap-3 w-full sm:w-auto">
              <div class="relative w-[80px] h-[80px] rounded-full overflow-hidden border-2 border-border/50 shadow-sm shrink-0">
                <img 
                  src={profilePicture || dicebearAvatar} 
                  alt="Avatar" 
                  class="w-full h-full object-cover bg-muted"
                />
              </div>
              <div class="flex items-center gap-2">
                <div class="relative">
                  <input type="file" accept="image/*" onchange={handleAvatarUpload} class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <button type="button" title="Upload Image" class="w-8 h-8 rounded-full bg-muted/50 border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
                    <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </button>
                </div>
                <button type="button" title="Shuffle Avatar" onclick={shuffleAvatar} class="w-8 h-8 rounded-full bg-muted/50 border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
                  <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>
            </div>

            <!-- Names Column -->
            <div class="flex-1 space-y-4 w-full">
              <div class="space-y-1.5">
                <label for="displayName" class="text-[13px] font-semibold text-foreground/80">Enter your name</label>
                <input 
                  id="displayName"
                  type="text" bind:value={displayName} placeholder="John Doe"
                  class="w-full bg-transparent border border-border/80 text-foreground placeholder:text-muted-foreground px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all rounded-md text-[15px]"
                />
              </div>
              <div class="space-y-1.5">
                <label for="username" class="text-[13px] font-semibold text-foreground/80">Username</label>
                <input 
                  id="username"
                  type="text" bind:value={username} placeholder="johndoe"
                  class="w-full bg-transparent border border-border/80 text-foreground placeholder:text-muted-foreground px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all rounded-md text-[15px]"
                />
              </div>
            </div>
          </div>

          <div class="space-y-1.5">
            <label for="branch" class="text-[13px] font-semibold text-foreground/80">Major</label>
            <input 
              id="branch"
              type="text" bind:value={branch} readonly disabled
              class="w-full bg-muted/50 border border-border/80 text-muted-foreground px-4 py-3 rounded-md outline-none cursor-not-allowed text-[15px]"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label for="currentYear" class="text-[13px] font-semibold text-foreground/80">Current Year</label>
              <Dropdown 
                id="currentYear"
                bind:value={currentYear} 
                placeholder="Select"
                options={[
                  { value: '1', label: '1st Year' },
                  { value: '2', label: '2nd Year' },
                  { value: '3', label: '3rd Year' },
                  { value: '4', label: '4th Year' }
                ]}
              />
            </div>
            <div class="space-y-1.5">
              <label for="passoutYear" class="text-[13px] font-semibold text-foreground/80">Passout Year</label>
              <input 
                id="passoutYear"
                type="number" bind:value={passoutYear} placeholder="2027"
                class="w-full bg-transparent border border-border/80 text-foreground placeholder:text-muted-foreground px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all rounded-md text-[15px]"
              />
            </div>
          </div>

          <div class="space-y-1.5">
            <label for="specialization" class="text-[13px] font-semibold text-foreground/80">Specialization</label>
            <Dropdown 
              id="specialization"
              bind:value={specialization} 
              placeholder="Select Specialization"
              options={[
                { value: 'Core', label: 'Core' },
                { value: 'AI', label: 'Artificial Intelligence' },
                { value: 'AI & ML', label: 'AI & ML' },
                { value: 'Big Data Analytics', label: 'Big Data Analytics' },
                { value: 'Cyber', label: 'Cyber Security' },
                { value: 'Block chain', label: 'Blockchain' },
                { value: 'Cloud computing', label: 'Cloud Computing' }
              ]}
            />
          </div>

          <div class="space-y-1.5">
            <label for="email" class="text-[13px] font-semibold text-foreground/80">University Email</label>
            <input 
              id="email"
              type="email" bind:value={email} placeholder="23...001@paruluniversity.ac.in"
              class="w-full bg-transparent border border-border/80 text-foreground placeholder:text-muted-foreground px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all rounded-md text-[15px]"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label for="password" class="text-[13px] font-semibold text-foreground/80">Password</label>
              <div class="relative">
                <input 
                  id="password"
                  type={showPassword ? "text" : "password"} bind:value={password} placeholder="••••••••"
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
            </div>
            <div class="space-y-1.5">
              <label for="confirmPassword" class="text-[13px] font-semibold text-foreground/80">Confirm</label>
              <div class="relative">
                <input 
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"} bind:value={confirmPassword} placeholder="••••••••"
                  class="w-full bg-transparent border border-border/80 text-foreground placeholder:text-muted-foreground px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all rounded-md text-[15px] pr-10"
                />
                <button 
                  type="button" 
                  onclick={() => showConfirmPassword = !showConfirmPassword}
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {#if showConfirmPassword}
                    <EyeOff class="w-4 h-4" />
                  {:else}
                    <Eye class="w-4 h-4" />
                  {/if}
                </button>
              </div>
            </div>
          </div>

          <button 
            type="button" 
            onclick={handleSendOtp}
            disabled={isLoading}
            class="btn-base btn-primary w-full py-3.5 mt-4"
          >
            {isLoading ? 'Verifying...' : 'Continue'}
          </button>
        </div>
      {:else}
        <!-- STEP 2: Verification -->
        <form onsubmit={handleFinalSignup} class="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
          
          <div class="text-center space-y-2">
            <p class="text-[13px] text-muted-foreground">Verification code sent to:</p>
            <p class="font-extrabold text-foreground text-[15px]">{email.toLowerCase()}</p>
            <button 
              type="button" 
              onclick={() => { step = 'registration'; successMsg = ''; errorMsg = ''; }}
              class="text-[#ff5400] text-xs font-bold hover:underline"
            >
              Incorrect email? Go back
            </button>
          </div>

          <div class="space-y-5">
            <label for="otp" class="block text-center text-[15px] font-semibold">Enter 6-digit code</label>
            <div id="otp" class="flex justify-center gap-2 sm:gap-3">
              {#each Array(6) as _, i}
                <input 
                  type="text" 
                  maxlength="1" 
                  data-index={i}
                  value={otpValues[i]}
                  oninput={(e) => handleOtpInput(e, i)}
                  onkeydown={(e) => handleOtpKeydown(e, i)}
                  onpaste={i === 0 ? handleOtpPaste : null}
                  class="w-10 h-12 sm:w-12 sm:h-14 bg-muted/30 border border-border text-foreground text-center text-xl font-bold rounded-lg outline-none focus:border-[#ff5400] focus:ring-1 focus:ring-[#ff5400] transition-all"
                />
              {/each}
            </div>

            <div class="text-center">
              <button 
                type="button" 
                onclick={handleResendOtp}
                class="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Didn't get it? <span class="text-[#ff5400] font-bold">Resend</span>
              </button>
            </div>
          </div>

          <div class="flex justify-center pt-2">
            <Checkbox bind:checked={terms} id="terms" label="Agree to Terms & Privacy" />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            class="btn-base btn-primary w-full py-3.5 mt-4"
          >
            {isLoading ? 'Creating Materio ID...' : 'Continue'}
          </button>
        </form>
      {/if}

      <div class="mt-8 text-center text-[14px]">
        <p class="text-muted-foreground">
          Already have a Materio ID? <a href="/login" class="text-foreground font-semibold hover:underline underline-offset-4">Log in instead</a>
        </p>
      </div>

    </div>
  </div>
</div>

<style>
  /* Custom scrollbar hiding for the form container */
  .hide-scrollbar {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
</style>
