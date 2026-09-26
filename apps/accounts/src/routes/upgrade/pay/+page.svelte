<script lang="ts">
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import {
    CreditCardIcon,
    Loading01Icon,
    CheckmarkCircle01Icon,
    ArrowLeft01Icon,
    LockIcon
  } from '@hugeicons/core-free-icons';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { addToast } from '$lib/stores/toast';
  import { userStore } from '$lib/stores/user.svelte';
  import Alert from '$lib/components/Alert.svelte';
  import ToastProvider from '$lib/components/ToastProvider.svelte';
  import { getAppUrls, getClientCookie, setClientCookie } from '@materio/config';
  import { openRazorpayCheckout, pollBillingForPlan } from '$lib/razorpay-checkout';

  const PLANS = {
    plus: {
      id: 'plus',
      label: 'Materio Plus',
      short: 'Plus',
      price: 199,
      features: ['20 Thinklet msgs/day', 'AI Summaries in Insightroom', 'Increased rate limits', 'More Customization', '10 Notebooks + cloud sync']
    },
    pro: {
      id: 'pro',
      label: 'Materio Pro',
      short: 'Pro',
      price: 349,
      features: ['Early access to features', 'Download PDFs', 'No Ratelimits', '50 Thinklet msgs/day', 'AI Summaries + Exclusive Posts', '50 Notebooks + cloud sync', 'Exclusive Perks']
    },
    weekly: {
      id: 'weekly',
      label: 'Weekly Pass',
      short: 'Weekly',
      price: 79,
      features: ['Full Pro access for 7 days', 'Early access to features', 'Download PDFs', 'No Ratelimits', '50 Thinklet msgs/day', 'AI Summaries + Exclusive Posts', '50 Notebooks + cloud sync', 'Exclusive Perks']
    }
  } as const;
  type PlanId = keyof typeof PLANS;

  let planId = $state<PlanId>('plus');
  let sessionParam = $state<string | null>(null);
  let billing = $state<any>(null);
  let loading = $state(true);
  let testMode = $state(true);

  // Test-mode method tab (live methods live on the hosted page).
  let method = $state<'upi' | 'card'>('card');
  let upiId = $state('');
  let cardName = $state('');
  let cardNumber = $state('');
  let expiry = $state('');
  let cvc = $state('');
  let paying = $state(false);
  let payError = $state('');
  let success = $state<any>(null);

  let plan = $derived(() => PLANS[planId]);
  let last4 = $derived(() => cardNumber.replace(/\D/g, '').slice(-4));
  let renewalDate = $derived(() => {
    const d = new Date();
    d.setDate(d.getDate() + (planId === 'weekly' ? 7 : 30));
    return d.toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' });
  });
  let priceSuffix = $derived(() => (planId === 'weekly' ? '/week' : '/month'));

  function loginRedirect() {
    const urls = getAppUrls(window.location.origin);
    const next = '/upgrade/pay?plan=' + planId + (sessionParam ? `&session=${encodeURIComponent(sessionParam)}` : '');
    window.location.href = `${urls.auth}/login?callback=${encodeURIComponent(window.location.origin + '/auth/callback?next=' + encodeURIComponent(next))}`;
  }

  function authToken() {
    return localStorage.getItem('token') || getClientCookie('materio_token') || '';
  }

  /** Standalone session bootstrap (no dashboard layout here). */
  async function initSession(): Promise<boolean> {
    // SSO handoff code exchange (?code=)
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      try {
        const res = await fetch('/api/v2/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'exchange', code })
        });
        const data = (await res.json()) as any;
        if (data.token) {
          localStorage.setItem('token', data.token);
          setClientCookie('materio_token', data.token);
          if (data.user) userStore.setUser(data.user);
        }
        params.delete('code');
        const qs = params.toString();
        window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
      } catch {}
    }

    let token = authToken();
    if (!token) {
      loginRedirect();
      return false;
    }
    // Keep storages in sync across apps.
    localStorage.setItem('token', token);
    if (!getClientCookie('materio_token')) setClientCookie('materio_token', token);

    try {
      const res = await fetch('/api/v2/profile', { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        loginRedirect();
        return false;
      }
      const data = (await res.json()) as any;
      if (data?.user) userStore.setUser(data.user);
    } catch {}
    return true;
  }

  async function refreshUser() {
    try {
      const res = await fetch('/api/v2/profile', { headers: { Authorization: `Bearer ${authToken()}` } });
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data?.user) userStore.setUser(data.user);
      }
    } catch {}
  }

  function formatCard(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  }

  function formatExpiry(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return digits.slice(0, 2) + '/' + digits.slice(2);
  }

  function validUpi() {
    if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upiId.trim())) return 'Enter your UPI ID (e.g. name@okhdfc)';
    return null;
  }

  function validForm() {
    if (method === 'upi') return validUpi();
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length !== 16) return 'Enter the 16-digit card number';
    const m = expiry.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
    if (!m) return 'Enter expiry as MM/YY';
    const exp = new Date(2000 + Number(m[2]), Number(m[1]));
    if (exp <= new Date()) return 'Card expiry must be in the future';
    if (!/^\d{3,4}$/.test(cvc)) return 'Enter the 3–4 digit CVC';
    if (!cardName.trim()) return 'Enter the name on card';
    if (!digits.startsWith('4718')) return 'Use the 4718 6091 0820 4366 test card for subscriptions';
    return null;
  }

  /** Test-mode mock charge → instant activation. */
  async function payTest() {
    payError = '';
    const err = validForm();
    if (err) {
      payError = err;
      return;
    }
    paying = true;
    try {
      const res = await fetch('/api/v2/billing/confirm-test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planId,
          sessionId: sessionParam || undefined,
          method,
          cardNumber: method === 'card' ? cardNumber : undefined,
          last4: method === 'card' ? last4() : undefined,
          upiId: method === 'upi' ? upiId.trim() : undefined
        })
      });
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || 'Test payment failed');
      success = data;
      addToast(data.message || 'Subscription activated!', 'success', plan().label);
      await refreshUser();
    } catch (e: any) {
      payError = e.message;
      addToast(e.message, 'error', 'Payment Failed');
    } finally {
      paying = false;
    }
  }

  /** Live styled Razorpay modal (UPI-first, Materio theme, locked backdrop). */
  async function payLive() {
    payError = '';
    paying = true;
    try {
      const res = await fetch('/api/v2/billing/checkout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId })
      });
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || 'Failed to start checkout');
      if (data.testMode || !data.subscriptionId) {
        if (data.url) window.location.href = data.url;
        return;
      }
      await openRazorpayCheckout({
        keyId: data.keyId,
        subscriptionId: data.subscriptionId,
        planLabel: planId === 'weekly' ? 'Weekly Pass' : plan().label,
        amountInr: plan().price,
        interval: planId === 'weekly' ? 'week' : 'month',
        email: userStore.user?.email ?? null,
        name: userStore.user?.displayName ?? userStore.user?.username ?? null,
        origin: window.location.origin,
        onSuccess: async () => {
          addToast('Payment authorized! Activating your plan…', 'info', 'Checkout');
          const want = planId === 'weekly' ? 'pro' : planId;
          const status = await pollBillingForPlan(want, 20, 2000);
          await refreshUser();
          if (status) {
            success = { expiry: status.expiry, last4: null, live: true };
          } else {
            addToast('Activation is still confirming — check back in a minute.', 'info', 'Almost there');
          }
        },
        onDismiss: () => {}
      });
    } catch (e: any) {
      payError = e.message;
      addToast(e.message, 'error', 'Payment Failed');
    } finally {
      paying = false;
    }
  }

  onMount(async () => {
    const q = $page.url.searchParams.get('plan');
    if (q === 'pro' || q === 'plus' || q === 'weekly') planId = q;
    sessionParam = $page.url.searchParams.get('session');
    if ($page.url.searchParams.get('cancelled') === '1') {
      addToast('Checkout was cancelled — no charge was made.', 'info', 'Payment Cancelled');
    }
    const ok = await initSession();
    if (!ok) return;
    try {
      const res = await fetch('/api/v2/billing/status', { headers: { Authorization: `Bearer ${authToken()}` } });
      if (res.ok) {
        billing = await res.json();
        testMode = billing?.testMode !== false;
      }
    } catch {}
    loading = false;
  });
</script>

<svelte:head>
  <title>Pay for {PLANS[planId].label} · Materio ID</title>
</svelte:head>

<div class="min-h-screen bg-background text-foreground font-sans">
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
    <!-- Top bar -->
    <div class="flex items-center justify-between mb-8 sm:mb-10">
      <img src="/logo-wordmark.webp" alt="Materio" class="h-7 sm:h-8 w-auto object-contain" />
      {#if !loading && !testMode}
        <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1.5">
          <HugeiconsIcon icon={LockIcon} size={13} /> Secured
        </span>
      {/if}
    </div>

    {#if loading}
      <div class="bg-card border border-border/60 rounded-2xl shadow-sm p-10 sm:p-14 flex flex-col items-center gap-4 text-muted-foreground">
        <HugeiconsIcon icon={Loading01Icon} size={24} class="animate-spin" />
        <p class="text-sm">Loading secure checkout…</p>
      </div>
    {:else if success}
      <div class="max-w-lg mx-auto bg-card border border-border/60 rounded-2xl shadow-sm p-8 sm:p-10 text-center space-y-4">
        <div class="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <HugeiconsIcon icon={CheckmarkCircle01Icon} size={28} class="text-emerald-500" />
        </div>
        <h1 class="text-2xl font-bold tracking-tight">Welcome to {plan().label}!</h1>
        <p class="text-sm text-muted-foreground leading-relaxed">
          {testMode ? 'No real charge was made. ' : ''}Your {plan().label} access is active until
          <span class="font-semibold text-foreground">{success.expiry ? new Date(success.expiry).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' }) : renewalDate()}</span>.
        </p>
        <div class="flex flex-col sm:flex-row justify-center gap-3 pt-3">
          <button onclick={() => goto('/upgrade')} class="btn-base btn-primary">View subscription</button>
          <button onclick={() => goto('/overview')} class="btn-base btn-secondary">Back to home</button>
        </div>
      </div>
    {:else}
      <button onclick={() => goto('/upgrade')} class="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
        <HugeiconsIcon icon={ArrowLeft01Icon} size={16} /> Back
      </button>

      <div class="mb-8">
        <h1 class="text-2xl sm:text-3xl font-bold tracking-tight">Get {planId === 'weekly' ? 'Weekly Pass' : plan().label}</h1>
        <p class="text-sm text-muted-foreground mt-2">{planId === 'weekly' ? 'Full Pro access for 7 days · ₹79/week · cancel anytime.' : 'Billed monthly · auto-renews · cancel anytime.'}</p>
      </div>

      {@const topFeatures = plan().features.slice(0, 5)}
      {@const moreCount = plan().features.length - topFeatures.length}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
        <!-- Payment method -->
        <div>
          <h2 class="font-semibold text-[17px] mb-5">Payment method</h2>
          {#if testMode}
            <div class="grid grid-cols-2 gap-3 mb-5">
              <button
                onclick={() => (method = 'upi')}
                class="flex items-center gap-3 p-4 rounded-2xl border text-left transition-all {method === 'upi' ? 'border-primary/60 ring-2 ring-primary/15 bg-card text-foreground' : 'border-border/60 text-muted-foreground hover:text-foreground'}"
              >
                <span class="text-[11px] font-extrabold tracking-wider border border-current rounded-md px-1.5 py-0.5 opacity-80">UPI</span>
                <span class="text-sm font-semibold">UPI</span>
              </button>
              <button
                onclick={() => (method = 'card')}
                class="flex items-center gap-3 p-4 rounded-2xl border text-left transition-all {method === 'card' ? 'border-primary/60 ring-2 ring-primary/15 bg-card text-foreground' : 'border-border/60 text-muted-foreground hover:text-foreground'}"
              >
                <HugeiconsIcon icon={CreditCardIcon} size={18} />
                <span class="text-sm font-semibold">Card</span>
              </button>
            </div>

            {#if method === 'card'}
              <div class="space-y-4">
                <div class="relative">
                  <input id="cc-num" type="text" inputmode="numeric" value={cardNumber} oninput={(e) => (cardNumber = formatCard((e.target as HTMLInputElement).value))}
                    placeholder="Card number" autocomplete="cc-number" aria-label="Card number"
                    class="w-full pl-4 pr-28 py-3.5 rounded-2xl border border-border/60 bg-muted/40 text-sm font-mono tracking-wider placeholder:text-muted-foreground/60 placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-ring transition-all" />
                  <span class="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold tracking-wider text-muted-foreground">VISA · MC · RuPay</span>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <input id="cc-exp" type="text" inputmode="numeric" value={expiry} oninput={(e) => (expiry = formatExpiry((e.target as HTMLInputElement).value))}
                    placeholder="Expiration date" autocomplete="cc-exp" aria-label="Expiration date"
                    class="w-full px-4 py-3.5 rounded-2xl border border-border/60 bg-muted/40 text-sm font-mono placeholder:text-muted-foreground/60 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-ring transition-all" />
                  <div class="relative">
                    <input id="cc-cvc" type="password" inputmode="numeric" bind:value={cvc} placeholder="Security code" maxlength="4" autocomplete="cc-csc" aria-label="Security code"
                      class="w-full pl-4 pr-10 py-3.5 rounded-2xl border border-border/60 bg-muted/40 text-sm font-mono placeholder:text-muted-foreground/60 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-ring transition-all" />
                    <HugeiconsIcon icon={LockIcon} size={14} class="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
                <div class="space-y-2">
                  <label for="cc-name" class="sr-only">Name on card</label>
                  <input id="cc-name" type="text" bind:value={cardName} placeholder="Name on card" autocomplete="cc-name"
                    class="w-full px-4 py-3.5 rounded-2xl border border-border/60 bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring transition-all" />
                </div>
                <p class="text-xs text-muted-foreground leading-relaxed">Use card <span class="font-mono font-medium text-foreground">4718 6091 0820 4366</span>, any future expiry, any CVC. No real charge is made.</p>
              </div>
            {:else}
              <div class="space-y-4">
                <div class="space-y-2">
                  <label for="upi-id" class="sr-only">UPI ID</label>
                  <input id="upi-id" type="text" bind:value={upiId} placeholder="Your UPI ID (e.g. name@okhdfc)" autocomplete="off"
                    class="w-full px-4 py-3.5 rounded-2xl border border-border/60 bg-muted/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring transition-all" />
                </div>
                <div class="rounded-2xl border border-border/60 px-4 py-3.5 text-[13px] leading-relaxed text-muted-foreground">
                  You'll approve a mandate in your UPI app for ₹{plan().price}{priceSuffix()}. Try <span class="font-mono font-medium text-foreground">success@razorpay</span> here — no real charge is made.
                </div>
                <p class="text-xs text-muted-foreground leading-relaxed">
                  By confirming, you allow Materio to charge this method {planId === 'weekly' ? 'every week' : 'every month'} until you cancel.
                </p>
              </div>
            {/if}

            {#if payError}
              <div class="mt-5"><Alert type="error" message={payError} /></div>
            {/if}
          {:else}
            <div class="rounded-2xl border border-border/60 px-5 py-5 space-y-3">
              <div class="flex items-center gap-3">
                <HugeiconsIcon icon={LockIcon} size={18} class="text-primary shrink-0" />
                <p class="text-sm leading-relaxed">UPI first, then cards, netbanking & wallets — in Materio orange, with your details already filled in.</p>
              </div>
              <p class="text-xs text-muted-foreground leading-relaxed">Autopay is set up automatically so renewals just work. No charge happens here.</p>
            </div>
            {#if payError}
              <div class="mt-5"><Alert type="error" message={payError} /></div>
            {/if}
          {/if}
        </div>

        <!-- Order summary -->
        <div class="bg-card border border-border/60 rounded-3xl shadow-sm p-6 sm:p-8">
          {#if planId === 'weekly'}
            <div class="flex gap-1 p-1 bg-muted/60 border border-border/60 rounded-xl mb-6">
              <div class="flex-1 py-2 px-3 rounded-lg text-sm font-semibold bg-card shadow-xs text-foreground border border-border/60 text-center">Weekly ₹79</div>
              <button
                onclick={() => (planId = 'pro')}
                class="flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all text-muted-foreground hover:text-foreground"
              >Monthly ₹349</button>
            </div>
          {:else}
            <div class="flex gap-1 p-1 bg-muted/60 border border-border/60 rounded-xl mb-6">
              <button
                onclick={() => (planId = 'plus')}
                class="flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all {planId === 'plus' ? 'bg-card shadow-xs text-foreground border border-border/60' : 'text-muted-foreground hover:text-foreground'}"
              >Plus ₹199</button>
              <button
                onclick={() => (planId = 'pro')}
                class="flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all {planId === 'pro' ? 'bg-card shadow-xs text-foreground border border-border/60' : 'text-muted-foreground hover:text-foreground'}"
              >Pro ₹349</button>
            </div>
          {/if}
          <h3 class="text-xl font-bold tracking-tight">{planId === 'weekly' ? 'Weekly Pass' : plan().label}</h3>
          <p class="text-sm text-muted-foreground mt-3">Top features</p>
          <ul class="mt-3 space-y-2.5">
            {#each topFeatures as f}
              <li class="flex items-start gap-2.5 text-sm leading-relaxed">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} class="text-primary shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            {/each}
          </ul>
          {#if moreCount > 0}
            <p class="text-xs text-muted-foreground mt-3">+{moreCount} more included</p>
          {/if}
          <div class="mt-6 pt-5 border-t border-border/50 space-y-2 text-sm">
            <div class="flex justify-between"><span class="text-muted-foreground">{planId === 'weekly' ? 'Weekly pass' : 'Monthly subscription'}</span><span>₹{plan().price}.00</span></div>
            <div class="flex justify-between font-semibold"><span>Due today</span><span>₹{plan().price}.00</span></div>
          </div>
          {#if testMode}
            <button onclick={payTest} disabled={paying} class="btn-base btn-primary w-full !py-3.5 !text-[15px] !rounded-full mt-6">
              {#if paying}
                <HugeiconsIcon icon={Loading01Icon} size={16} class="animate-spin" />
                <span>Processing…</span>
              {:else}
                <span>Subscribe · ₹{plan().price}{priceSuffix()}</span>
              {/if}
            </button>
          {:else}
            <button onclick={payLive} disabled={paying} class="btn-base btn-primary w-full !py-3.5 !text-[15px] !rounded-full mt-6">
              {#if paying}
                <HugeiconsIcon icon={Loading01Icon} size={16} class="animate-spin" />
                <span>Opening secure page…</span>
              {:else}
                <HugeiconsIcon icon={LockIcon} size={15} />
                <span>Continue · ₹{plan().price}{priceSuffix()}</span>
              {/if}
            </button>
          {/if}
          <p class="text-xs text-muted-foreground leading-relaxed mt-5">
            ₹{plan().price} {planId === 'weekly' ? 'for 7 days of Pro' : 'now, then ₹' + plan().price + '/month'}. Renews {planId === 'weekly' ? 'weekly' : 'monthly'} until cancelled. Cancel anytime from Payments and Subscription.
          </p>
        </div>
      </div>

      <p class="text-center text-xs text-muted-foreground mt-10">
        Encrypted checkout · This is a secure Materio ID payment page
      </p>
    {/if}
  </div>
</div>

<ToastProvider />
