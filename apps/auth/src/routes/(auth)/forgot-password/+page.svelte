<svelte:head>
  <title>Reset Password - Materio ID</title>
</svelte:head>

<script lang="ts">
  import { page } from '$app/stores';
  import AuthCard from '$lib/components/AuthCard.svelte';
  import LineArtBackground from '$lib/components/LineArtBackground.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import BudLogo from '@materio/ui/components/BudLogo.svelte';
  import { ArrowLeft } from 'lucide-svelte';

  let email = $state('');
  let isLoading = $state(false);
  let error = $state('');
  let sent = $state(false);

  function callbackParam() {
    return $page.url.searchParams.get('callback') || '';
  }

  function signInHref() {
    const cb = callbackParam();
    return cb ? `/login?callback=${encodeURIComponent(cb)}` : '/login';
  }

  function handleReset(e: Event) {
    e.preventDefault();
    error = '';
    if (!email.trim()) {
      error = 'Please enter your email address.';
      return;
    }
    // Implementation for reset password
    isLoading = true;
    try {
      sent = true;
    } finally {
      isLoading = false;
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

      <!-- Animated Bud Logo Brand Header -->
      <div class="flex justify-center mb-6 pt-4 overflow-visible">
        <BudLogo class="w-16 h-16 text-foreground overflow-visible" />
      </div>

      <!-- Section Header -->
      <div class="text-center mb-6">
        <h1 class="text-3xl sm:text-[34px] font-serif font-normal text-foreground tracking-tight leading-tight mb-2">
          Reset your password
        </h1>
        <p class="text-sm text-muted-foreground">
          {#if sent}
            Check your inbox for the reset link.
          {:else}
            Enter your account email and we'll send you a reset link.
          {/if}
        </p>
      </div>

      {#if sent}
        <div class="space-y-4 animate-in fade-in duration-200">
          <p class="text-sm text-muted-foreground text-center leading-relaxed">
            If an account exists for <span class="font-medium text-foreground">{email}</span>,
            a password reset link is on its way. It expires soon, so check your inbox
            (and spam folder).
          </p>
          <a
            href={signInHref()}
            class="w-full h-12 rounded-[14px] bg-[#a34914] dark:bg-[#c05a1e] hover:bg-[#c05a1e] dark:hover:bg-[#a34914] text-white font-medium text-[14px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
          >
            <span>Back to sign in</span>
          </a>
        </div>
      {:else}
        <form onsubmit={handleReset} class="space-y-3 pt-1 animate-in fade-in duration-200">
          <div>
            <input
              type="email"
              bind:value={email}
              oninput={() => error = ''}
              required
              placeholder="Email address"
              class="auth-input w-full h-12 px-4 rounded-[14px] border text-foreground placeholder:text-muted-foreground text-[14px] outline-none ring-2 ring-[#c05a1e]/25 dark:ring-[#c05a1e]/30 border-[#c05a1e]/60 dark:border-[#c05a1e]/80 transition-all font-sans"
            />
            {#if error}
              <p class="text-[13px] text-[#e95d3d] dark:text-[#ff6b4a] pt-1.5 px-1 leading-snug font-normal animate-in fade-in duration-150">
                {error}
              </p>
            {/if}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            class="w-full h-12 rounded-[14px] bg-[#a34914] dark:bg-[#c05a1e] hover:bg-[#c05a1e] dark:hover:bg-[#a34914] text-white font-medium text-[14px] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {#if isLoading}
              <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Sending…</span>
            {:else}
              <span>Send reset link</span>
            {/if}
          </button>

          <div class="flex justify-center pt-1">
            <a
              href={signInHref()}
              class="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft class="w-3.5 h-3.5" />
              <span>Back to sign in</span>
            </a>
          </div>
        </form>
      {/if}

      <!-- Terms and Privacy Footer -->
      <div class="mt-6 text-center">
        <p class="text-[11px] text-muted-foreground leading-relaxed">
          By continuing, you agree to the{' '}
          <a href="https://getmaterio.app/terms" target="_blank" class="text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">Terms of Service</a>
          {' '}and{' '}
          <a href="https://getmaterio.app/privacy" target="_blank" class="text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">Privacy Policy</a>.
        </p>
      </div>

    </AuthCard>
  </main>
</div>
