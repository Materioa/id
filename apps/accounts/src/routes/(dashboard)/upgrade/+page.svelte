<script lang="ts">
  import { HugeiconsIcon } from '@hugeicons/svelte';
  import {
    Tag01Icon,
    CreditCardIcon,
    Loading01Icon,
    AlertCircleIcon,
    CheckmarkCircle01Icon,
    Cancel01Icon,
    UserIcon,
    ZapIcon,
    Tick01Icon,
    Invoice01Icon,
    RefreshIcon,
    Download01Icon
  } from '@hugeicons/core-free-icons';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { addToast } from '$lib/stores/toast';
  import { userStore } from '$lib/stores/user.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import Alert from '$lib/components/Alert.svelte';
  import { fade } from 'svelte/transition';
  import { openRazorpayCheckout, pollBillingForPlan } from '$lib/razorpay-checkout';
  import { getAppUrls } from '@materio/config';

  // ---- Plans: Plus ₹199/mo, Pro ₹349/mo (monthly, auto-renew) ----
  const PLANS = {
    plus: {
      id: 'plus',
      label: 'Materio Plus',
      short: 'Plus',
      price: 199,
      blurb: 'More AI, more space for everyday learners.',
      features: [
        '20 messages per day in Thinklet',
        'AI Summaries in Insightroom Posts',
        'Increased rate limits',
        'More Customization',
        'Create 10 Notebooks with cloud sync'
      ]
    },
    pro: {
      id: 'pro',
      label: 'Materio Pro',
      short: 'Pro',
      price: 349,
      blurb: 'Everything unlimited for power learners.',
      features: [
        'Early access to new features',
        'Download PDFs',
        'No Ratelimits',
        '50 messages per day in Thinklet',
        'AI Summaries in Insightroom + Exclusive Posts',
        '50 Notebooks with Cloud sync',
        'More Customization and Other Exclusive Perks'
      ]
    },
    weekly: {
      id: 'weekly',
      label: 'Weekly Pass',
      short: 'Weekly',
      price: 79,
      blurb: 'Full Pro access for 7 days.',
      features: [
        'Full Pro access for 7 days',
        'Early access to new features',
        'Download PDFs',
        'No Ratelimits',
        '50 messages per day in Thinklet',
        'AI Summaries in Insightroom + Exclusive Posts',
        '50 Notebooks with Cloud sync',
        'More Customization and Other Exclusive Perks'
      ]
    }
  } as const;

  type PlanId = keyof typeof PLANS;

  // ---- Billing status ----
  let billing = $state<any>(null);
  let billingLoading = $state(true);
  let billingError = $state('');
  let checkoutBusy = $state<PlanId | null>(null);

  // ---- Invoices ----
  let invoices = $state<any[]>([]);
  let invoicesLoading = $state(true);

  const planLabels: Record<string, string> = { plus: 'Plus', pro: 'Pro', weekly: 'Weekly Pass' };

  // ---- Redeem state ----
  let giftCode = $state('');
  let isRedeeming = $state(false);
  let redeemError = $state('');
  let redeemSuccess = $state('');

  // ---- Cancel state ----
  let showCancelModal = $state(false);
  let isCancelling = $state(false);
  let cancelError = $state('');
  let cancelImmediate = $state(false);

  // ---- Transfer (super user) state ----
  let showTransferModal = $state(false);
  let successorUsername = $state('');
  let isTransferring = $state(false);
  let transferError = $state('');

  let effectivePlan = $derived(() => {
    if (userStore.user?.hasAdminPrivileges) return 'super';
    const p = billing?.plan;
    if (p === 'pro' || p === 'plus') return p;
    if (userStore.user?.isPlusUser) return 'pro';
    if (userStore.user?.isLiteUser) return 'plus';
    return null;
  });

  let planKey = $derived(() => {
    const p = effectivePlan();
    return p === 'pro' || p === 'plus' ? (p as PlanId) : null;
  });

  let hasSubscription = $derived(() => effectivePlan() !== null);
  let isSuperUser = $derived(() => userStore.user?.hasAdminPrivileges === true);
  let periodEnd = $derived(() => billing?.subscription?.periodEnd || billing?.expiry || userStore.user?.plusExpiry || null);
  let subStatus = $derived(() => billing?.subscription?.status || null);
  let isLifetime = $derived(() => billing?.lifetime === true || (hasSubscription() && !isSuperUser() && !periodEnd()));
  let isWeekly = $derived(() => billing?.subscription?.plan === 'weekly');
  let monthlyProActive = $derived(() => planKey() === 'pro' && !isWeekly());
  let proBilling = $state<'monthly' | 'weekly'>('monthly');

  const planConfig: Record<string, { label: string }> = {
    super: { label: 'Materio Super' },
    pro: { label: 'Materio Pro' },
    plus: { label: 'Materio Plus' }
  };

  function loginRedirect(next = '/upgrade') {
    const urls = getAppUrls(window.location.origin);
    window.location.href = `${urls.auth}/login?callback=${encodeURIComponent(window.location.origin + '/auth/callback?next=' + encodeURIComponent(next))}`;
  }

  function authHeaders() {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  async function refreshUser() {
    try {
      const res = await fetch('/api/v2/profile', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (res.ok) {
        const data = (await res.json()) as any;
        if (data?.user) userStore.setUser(data.user);
      }
    } catch {}
  }

  async function loadBilling() {
    billingLoading = true;
    billingError = '';
    try {
      const res = await fetch('/api/v2/billing/status', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      const data = (await res.json()) as any;
      if (res.status === 401) {
        loginRedirect();
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load billing details');
      billing = data;
      if (billing?.subscription?.plan === 'weekly') proBilling = 'weekly';
    } catch (err: any) {
      billingError = err.message;
    } finally {
      billingLoading = false;
    }
  }

  function checkoutModalOpts(plan: PlanId) {
    return {
      keyId: '',
      subscriptionId: '',
      planLabel: PLANS[plan].label,
      amountInr: PLANS[plan].price,
      interval: (plan === 'weekly' ? 'week' : 'month') as 'week' | 'month',
      email: userStore.user?.email ?? null,
      name: userStore.user?.displayName ?? userStore.user?.username ?? null,
      origin: window.location.origin
    };
  }

  async function startCheckout(plan: PlanId) {
    // No token (or an expired one) must send you to login — never a raw 401.
    if (!localStorage.getItem('token')) {
      loginRedirect(`/upgrade/pay?plan=${plan}`);
      return;
    }
    checkoutBusy = plan;
    try {
      const res = await fetch('/api/v2/billing/checkout', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ plan })
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        if (res.status === 401) {
          loginRedirect(`/upgrade/pay?plan=${plan}`);
          return;
        }
        if (res.status === 409) {
          addToast(data.error || 'Plan already active', 'info', 'Subscription');
          return;
        }
        throw new Error(data.error || 'Failed to start checkout');
      }
      // Test mode goes to the custom pay screen in this tab.
      if (data.testMode || !data.subscriptionId) {
        if (data.url) window.location.href = data.url;
        else await goto(`/upgrade/pay?plan=${plan}`);
        return;
      }
      // Live: styled Razorpay modal (UPI-first, Materio theme, locked backdrop).
      await openRazorpayCheckout({
        ...checkoutModalOpts(plan),
        keyId: data.keyId,
        subscriptionId: data.subscriptionId,
        onSuccess: async () => {
          addToast('Payment authorized! Activating your plan…', 'info', 'Checkout');
          const want = plan === 'weekly' ? 'pro' : plan;
          const status = await pollBillingForPlan(want, 20, 2000);
          await refreshUser();
          await loadBilling();
          await loadInvoices();
          if (status) addToast('Payment successful! Your plan is now active.', 'success', 'Welcome');
        },
        onDismiss: () => {}
      });
    } catch (err: any) {
      addToast(err.message, 'error', 'Checkout Failed');
    } finally {
      checkoutBusy = null;
    }
  }

  function goPay(plan: PlanId) {
    goto(`/upgrade/pay?plan=${plan}`);
  }

  async function redeemGiftCode() {
    if (!giftCode.trim()) return;
    isRedeeming = true;
    redeemError = '';
    redeemSuccess = '';
    try {
      const res = await fetch('/api/v2/subscription/redeem', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ code: giftCode.trim() })
      });
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || 'Failed to redeem code');
      redeemSuccess = data.message || 'Subscription activated!';
      giftCode = '';
      addToast(redeemSuccess, 'success', 'Gift Code Redeemed');
      await refreshUser();
      await loadBilling();
    } catch (err: any) {
      redeemError = err.message;
      addToast(err.message, 'error', 'Redeem Failed');
    } finally {
      isRedeeming = false;
    }
  }

  function handleCancelClick() {
    cancelError = '';
    cancelImmediate = false;
    if (isSuperUser()) showTransferModal = true;
    else showCancelModal = true;
  }

  async function confirmCancel() {
    isCancelling = true;
    cancelError = '';
    try {
      // At-period-end cancellations go through the billing API (Razorpay-aware,
      // keeps access until renewal date). Immediate uses the same endpoint.
      const res = await fetch('/api/v2/billing/cancel', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ immediate: cancelImmediate })
      });
      const data = (await res.json()) as any;
      if (!res.ok) {
        if (data.requiresTransfer) {
          showCancelModal = false;
          showTransferModal = true;
          return;
        }
        throw new Error(data.error || 'Failed to cancel subscription');
      }
      showCancelModal = false;
      addToast(data.message || 'Subscription cancelled', 'success', 'Plan Cancelled');
      await refreshUser();
      await loadBilling();
    } catch (err: any) {
      cancelError = err.message;
    } finally {
      isCancelling = false;
    }
  }

  async function confirmTransfer() {
    if (!successorUsername.trim()) {
      transferError = 'Please enter a username';
      return;
    }
    isTransferring = true;
    transferError = '';
    try {
      const res = await fetch('/api/v2/subscription/transfer-admin', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ successorUsername: successorUsername.trim() })
      });
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || 'Failed to transfer admin privileges');
      showTransferModal = false;
      successorUsername = '';
      addToast(data.message || 'Admin privileges transferred', 'success', 'Transfer Complete');
      await refreshUser();
      await loadBilling();
    } catch (err: any) {
      transferError = err.message;
    } finally {
      isTransferring = false;
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function formatAmount(paise: number, currency = 'inr') {
    return `₹${(paise / 100).toLocaleString('en-IN')}`;
  }

  let downloadingId = $state<string | null>(null);

  async function downloadInvoice(inv: any) {
    downloadingId = inv.id;
    try {
      const res = await fetch(`/api/v2/billing/invoices/${encodeURIComponent(inv.id)}/pdf`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.status === 401) {
        loginRedirect();
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as any;
        throw new Error(data.error || data.details || `Failed to download invoice (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = inv.date ? new Date(inv.date).toISOString().slice(0, 10) : 'receipt';
      a.href = url;
      a.download = `materio-invoice-${stamp}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err: any) {
      addToast(err.message, 'error', 'Download Failed');
    } finally {
      downloadingId = null;
    }
  }

  async function loadInvoices() {
    invoicesLoading = true;
    try {
      const res = await fetch('/api/v2/billing/invoices', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (res.status === 401) {
        loginRedirect();
        return;
      }
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || 'Failed to load invoices');
      invoices = data.invoices || [];
    } catch {
      invoices = [];
    } finally {
      invoicesLoading = false;
    }
  }

  onMount(async () => {
    await Promise.all([loadBilling(), loadInvoices()]);
    const payment = $page.url.searchParams.get('payment');
    const session = $page.url.searchParams.get('session_id');
    if (payment === 'success') {
      // Payment succeeded at the provider — but access is granted by the
      // webhook, which can lag (or never reach local dev). Verify before celebrating.
      let confirmed: any = null;
      for (let i = 0; i < 10; i++) {
        try {
          const res = await fetch('/api/v2/billing/status', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
          if (res.ok) {
            const data = (await res.json()) as any;
            if (data?.plan === 'plus' || data?.plan === 'pro') {
              confirmed = data;
              break;
            }
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 1500));
      }
      await refreshUser();
      await loadBilling();
      if (confirmed && (confirmed.plan === 'plus' || confirmed.plan === 'pro')) {
        addToast('Payment successful! Your plan is now active.', 'success', 'Welcome');
      } else {
        addToast('Payment received — activation is still confirming. Refresh in a minute.', 'info', 'Almost there');
      }
      // Clean the URL (keep plan for context).
      const url = new URL(window.location.href);
      url.searchParams.delete('payment');
      if (session) url.searchParams.delete('session_id');
      window.history.replaceState({}, '', url.toString());
    }
  });
</script>

<svelte:head>
  <title>Payments and Subscription</title>
</svelte:head>

<div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto p-6">
  <div class="flex flex-col sm:flex-row sm:items-center items-start justify-between gap-4 border-b border-border/60 pb-6">
    <div>
      <h1 class="text-2xl font-bold tracking-tight text-foreground">Payments and Subscription</h1>
      <p class="text-sm text-muted-foreground mt-1">Plans, billing details, renewal and cancellation.</p>
    </div>
  </div>

  {#if billingLoading}
    <div class="bg-card border border-border/60 p-10 shadow-sm rounded-2xl flex flex-col items-center gap-3 text-muted-foreground">
      <HugeiconsIcon icon={Loading01Icon} size={22} class="animate-spin" />
      <p class="text-sm">Loading billing details…</p>
    </div>
  {:else}
    {#if billingError}
      <Alert type="error" message={billingError} />
    {/if}

    <!-- Current plan + billing details -->
    <div class="bg-card border border-border/60 p-6 shadow-sm rounded-2xl">
      <div class="flex items-center gap-2 border-b border-border/50 pb-4 mb-6">
        <HugeiconsIcon icon={CreditCardIcon} size={18} class="text-muted-foreground" />
        <h3 class="font-semibold text-foreground text-sm">Your Subscription</h3>
      </div>

      {#if hasSubscription()}
        {@const key = effectivePlan()!}
        {@const config = planConfig[key]}
        {@const plan = planKey() ? PLANS[planKey()!] : null}
        <div class="space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div class="flex items-center gap-2">
                <h4 class="font-bold text-foreground text-lg">{config.label}</h4>
              </div>
              {#if plan}
                {#if isWeekly()}
                  <p class="text-sm text-muted-foreground mt-1">Weekly Pass · full Pro access, renews every 7 days</p>
                {:else}
                  <p class="text-sm text-muted-foreground mt-1">₹{plan.price}/month · auto-renews every 30 days</p>
                {/if}
              {/if}
              {#if isLifetime()}
                <p class="text-sm text-muted-foreground mt-0.5">
                  <span class="font-medium text-foreground">Never expires</span> · gifted access
                </p>
              {:else if periodEnd()}
                <p class="text-sm text-muted-foreground mt-0.5">
                  {#if subStatus() === 'cancel_at_period_end'}
                    Access until <span class="font-medium text-foreground">{formatDate(periodEnd()!)}</span> · renewal turned off
                  {:else}
                    Renews on <span class="font-medium text-foreground">{formatDate(periodEnd()!)}</span>
                  {/if}
                </p>
              {:else if isSuperUser()}
                <p class="text-sm text-muted-foreground mt-0.5"><span class="font-medium">Never expires</span> · admin access</p>
              {:else}
                <p class="text-sm text-muted-foreground mt-0.5"><span class="font-medium">Monthly plan</span></p>
              {/if}
            </div>
            {#if !isSuperUser() && planKey() && !isLifetime()}
              <div class="flex flex-col sm:flex-row gap-2 shrink-0">
                {#if planKey() === 'plus'}
                  <button onclick={() => startCheckout('pro')} disabled={checkoutBusy !== null} class="btn-base btn-primary">
                    {#if checkoutBusy === 'pro'}<HugeiconsIcon icon={Loading01Icon} size={16} class="animate-spin" />{:else}<HugeiconsIcon icon={ZapIcon} size={16} />{/if}
                    <span>Upgrade to Pro</span>
                  </button>
                {:else}
                  <button onclick={() => startCheckout('plus')} disabled={checkoutBusy !== null} class="btn-base btn-secondary">
                    {#if checkoutBusy === 'plus'}<HugeiconsIcon icon={Loading01Icon} size={16} class="animate-spin" />{:else}<HugeiconsIcon icon={RefreshIcon} size={16} />{/if}
                    <span>Switch to Plus</span>
                  </button>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Billing details -->
          <div class="pt-1">
            <div class="flex items-center justify-between py-2.5 border-b border-border/40">
              <span class="text-sm text-muted-foreground">Next renewal</span>
              <span class="text-sm font-medium text-foreground">{isLifetime() ? 'Never' : periodEnd() ? formatDate(periodEnd()!) : '—'}</span>
            </div>
            <div class="flex items-center justify-between py-2.5 border-b border-border/40">
              <span class="text-sm text-muted-foreground">Amount</span>
              <span class="text-sm font-medium text-foreground">{isLifetime() ? 'Free' : plan ? `₹${plan.price}/${isWeekly() ? 'week' : 'month'}` : '—'}</span>
            </div>
            <div class="flex items-center justify-between py-2.5">
              <span class="text-sm text-muted-foreground">Payment method</span>
              <span class="text-sm font-medium text-foreground">{isLifetime() ? 'Gift code' : 'Online payment'}</span>
            </div>
          </div>

          <!-- Cancel Plan -->
          {#if !isSuperUser()}
            <div class="pt-2 border-t border-border/50">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 class="text-sm font-semibold text-foreground">Cancel Plan</h4>
                  {#if isLifetime()}
                    <p class="text-sm text-muted-foreground mt-0.5">Give up your lifetime access and return to the free plan.</p>
                  {:else}
                    <p class="text-sm text-muted-foreground mt-0.5">Turn off auto-renewal. You keep access until {periodEnd() ? formatDate(periodEnd()!) : 'the end of the billing period'}.</p>
                  {/if}
                </div>
                <button onclick={handleCancelClick} class="btn-base btn-destructive shrink-0">
                  <span>{!isLifetime() && subStatus() === 'cancel_at_period_end' ? 'Manage Cancellation' : 'Cancel Plan'}</span>
                </button>
              </div>
            </div>
          {:else}
            <div class="pt-2 border-t border-border/50">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 class="text-sm font-semibold text-foreground">Cancel Plan</h4>
                  <p class="text-sm text-muted-foreground mt-0.5">You must transfer admin privileges before cancelling.</p>
                </div>
                <button onclick={handleCancelClick} class="btn-base btn-destructive shrink-0">
                  <span>Transfer & Cancel</span>
                </button>
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <div class="space-y-3">
          <h4 class="font-bold text-foreground text-lg">Free plan</h4>
          <p class="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            You're on the free plan. Plus and Pro bill monthly and renew automatically
            until you cancel — or grab a 7-day Weekly Pass for full Pro access.
          </p>
        </div>
      {/if}
    </div>

    <!-- Plans (hidden for super users and lifetime holders) -->
    {#if !isSuperUser() && !isLifetime()}
      {@const plus = PLANS.plus}
      {@const plusCurrent = planKey() === 'plus'}
      {@const pro = PLANS.pro}
      {@const weekly = PLANS.weekly}
      {@const proCurrent = planKey() === 'pro' || isWeekly()}
      {@const sel = proBilling === 'weekly' ? weekly : pro}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Plus card -->
        <div class="bg-card border {plusCurrent ? 'border-primary/60 ring-2 ring-primary/15' : 'border-border/60'} p-6 shadow-sm rounded-2xl flex flex-col">
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-foreground">{plus.label}</h3>
            {#if plusCurrent}
              <span class="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={13} /> Current
              </span>
            {:else}
              <span class="text-[11px] font-semibold uppercase tracking-wider text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1">Most popular</span>
            {/if}
          </div>
          <div class="flex items-baseline gap-1 mt-2">
            <span class="text-3xl font-bold tracking-tight text-foreground">₹{plus.price}</span>
            <span class="text-sm text-muted-foreground">/month</span>
          </div>
          <p class="text-sm text-muted-foreground mt-1">{plus.blurb}</p>
          <ul class="mt-4 mb-6 space-y-2">
            {#each plus.features as f}
              <li class="flex items-start gap-2 text-[13px] text-foreground/90 leading-relaxed">
                <HugeiconsIcon icon={Tick01Icon} size={15} class="text-primary shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            {/each}
          </ul>
          <div class="mt-auto flex gap-2">
            {#if plusCurrent}
              <button onclick={() => goPay('plus')} class="btn-base btn-secondary flex-1">Manage payment</button>
            {:else if hasSubscription()}
              <button onclick={() => startCheckout('plus')} disabled={checkoutBusy !== null} class="btn-base btn-secondary flex-1">
                {#if checkoutBusy === 'plus'}<HugeiconsIcon icon={Loading01Icon} size={16} class="animate-spin" />{/if}
                <span>Switch to Plus · ₹{plus.price}/mo</span>
              </button>
            {:else}
              <button onclick={() => startCheckout('plus')} disabled={checkoutBusy !== null} class="btn-base btn-primary flex-1">
                {#if checkoutBusy === 'plus'}<HugeiconsIcon icon={Loading01Icon} size={16} class="animate-spin" />{/if}
                <span>Choose Plus · ₹{plus.price}/mo</span>
              </button>
            {/if}
          </div>
        </div>

        <!-- Pro card with Monthly / Weekly Pass toggle -->
        <div class="bg-card border {proCurrent ? 'border-primary/60 ring-2 ring-primary/15' : 'border-border/60'} p-6 shadow-sm rounded-2xl flex flex-col">
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-foreground">{pro.label}</h3>
            {#if proCurrent}
              <span class="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={13} /> Current
              </span>
            {/if}
          </div>
          {#if !monthlyProActive()}
            <div class="flex gap-1 p-1 mt-4 bg-muted/60 border border-border/60 rounded-xl">
              <button
                onclick={() => (proBilling = 'monthly')}
                class="flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all {proBilling === 'monthly' ? 'bg-card shadow-xs text-foreground border border-border/60' : 'text-muted-foreground hover:text-foreground'}"
              >Monthly ₹349</button>
              <button
                onclick={() => (proBilling = 'weekly')}
                class="flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all {proBilling === 'weekly' ? 'bg-card shadow-xs text-foreground border border-border/60' : 'text-muted-foreground hover:text-foreground'}"
              >Weekly ₹79</button>
            </div>
          {/if}
          <div class="flex items-baseline gap-1 mt-3">
            <span class="text-3xl font-bold tracking-tight text-foreground">₹{sel.price}</span>
            <span class="text-sm text-muted-foreground">/{proBilling === 'weekly' ? 'week' : 'month'}</span>
          </div>
          <p class="text-sm text-muted-foreground mt-1">{proBilling === 'weekly' ? weekly.blurb : pro.blurb}</p>
          <ul class="mt-4 mb-6 space-y-2">
            {#each pro.features as f}
              <li class="flex items-start gap-2 text-[13px] text-foreground/90 leading-relaxed">
                <HugeiconsIcon icon={Tick01Icon} size={15} class="text-primary shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            {/each}
          </ul>
          <div class="mt-auto flex gap-2">
            {#if proCurrent && ((isWeekly() && proBilling === 'weekly') || (monthlyProActive() ))}
              <button onclick={() => goPay(isWeekly() ? 'weekly' : 'pro')} class="btn-base btn-secondary flex-1">Manage payment</button>
            {:else if proBilling === 'weekly'}
              {#if monthlyProActive()}
                <button disabled class="btn-base btn-secondary flex-1">On Monthly Pro</button>
              {:else if hasSubscription()}
                <button onclick={() => startCheckout('weekly')} disabled={checkoutBusy !== null} class="btn-base btn-secondary flex-1">
                  {#if checkoutBusy === 'weekly'}<HugeiconsIcon icon={Loading01Icon} size={16} class="animate-spin" />{/if}
                  <span>Switch to Weekly · ₹79/week</span>
                </button>
              {:else}
                <button onclick={() => startCheckout('weekly')} disabled={checkoutBusy !== null} class="btn-base btn-primary flex-1">
                  {#if checkoutBusy === 'weekly'}<HugeiconsIcon icon={Loading01Icon} size={16} class="animate-spin" />{/if}
                  <span>Get Weekly Pass · ₹79/week</span>
                </button>
              {/if}
            {:else if hasSubscription()}
              <button onclick={() => startCheckout('pro')} disabled={checkoutBusy !== null} class="btn-base btn-secondary flex-1">
                {#if checkoutBusy === 'pro'}<HugeiconsIcon icon={Loading01Icon} size={16} class="animate-spin" />{/if}
                <span>Switch to Pro · ₹349/mo</span>
              </button>
            {:else}
              <button onclick={() => startCheckout('pro')} disabled={checkoutBusy !== null} class="btn-base btn-primary flex-1">
                {#if checkoutBusy === 'pro'}<HugeiconsIcon icon={Loading01Icon} size={16} class="animate-spin" />{/if}
                <span>Choose Pro · ₹349/mo</span>
              </button>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- Invoices -->
    <div class="bg-card border border-border/60 p-6 shadow-sm rounded-2xl">
      <div class="flex items-center gap-2 border-b border-border/50 pb-4 mb-2">
        <HugeiconsIcon icon={Invoice01Icon} size={18} class="text-muted-foreground" />
        <h3 class="font-semibold text-foreground text-sm">Invoices</h3>
      </div>
      {#if invoicesLoading}
        <div class="flex items-center gap-3 py-6 text-muted-foreground">
          <HugeiconsIcon icon={Loading01Icon} size={18} class="animate-spin" />
          <p class="text-sm">Loading invoices…</p>
        </div>
      {:else if invoices.length}
        <div>
          {#each invoices as inv}
            <div class="flex items-center gap-3 py-3.5 border-b border-border/40 last:border-0">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-foreground truncate">
                  {planLabels[inv.plan] || 'Payment'} · {formatAmount(inv.amountPaise, inv.currency)}
                </p>
                <p class="text-xs text-muted-foreground mt-0.5 capitalize">
                  {inv.date ? formatDate(inv.date) : '—'} · {String(inv.status || '').replace(/_/g, ' ') || 'recorded'}
                </p>
              </div>
              <button
                onclick={() => downloadInvoice(inv)}
                disabled={downloadingId !== null}
                title="Download invoice PDF"
                class="shrink-0 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground border border-border/60 hover:border-border rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
              >
                {#if downloadingId === inv.id}
                  <HugeiconsIcon icon={Loading01Icon} size={16} class="animate-spin" />
                {:else}
                  <HugeiconsIcon icon={Download01Icon} size={15} />
                {/if}
                <span>Invoice</span>
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-sm text-muted-foreground leading-relaxed py-2">No invoices yet. They'll appear here after your first payment.</p>
      {/if}
    </div>

    <!-- Redeem Gift Code -->
    <div class="bg-card border border-border/60 p-6 shadow-sm rounded-2xl">
      <div class="flex items-center gap-2 border-b border-border/50 pb-4 mb-6">
        <HugeiconsIcon icon={Tag01Icon} size={18} class="text-muted-foreground" />
        <h3 class="font-semibold text-foreground text-sm">Redeem Gift Code</h3>
      </div>
      <div class="space-y-5">
        <p class="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          Have a gift code? Enter it below to activate your Materio subscription.
        </p>
        {#if hasSubscription()}
          <div class="flex items-start gap-3 py-2">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} size={20} class="text-primary shrink-0 mt-0.5" />
            <p class="text-sm text-foreground">
              You have an active <span class="font-semibold">{effectivePlan()}</span> subscription.
            </p>
          </div>
        {:else}
          <div class="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              bind:value={giftCode}
              placeholder="YOUR-GIFT-CODE"
              disabled={isRedeeming}
              class="flex-1 px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background transition-all uppercase tracking-wider font-mono"
              onkeydown={(e) => { if (e.key === 'Enter') redeemGiftCode(); }}
            />
            <button onclick={redeemGiftCode} disabled={isRedeeming || !giftCode.trim()} class="btn-base btn-primary shrink-0">
              {#if isRedeeming}
                <HugeiconsIcon icon={Loading01Icon} size={16} class="animate-spin" />
                <span>Redeeming...</span>
              {:else}
                <span>Redeem</span>
              {/if}
            </button>
          </div>
          {#if redeemError}
            <div transition:fade={{ duration: 200 }} class="flex items-start gap-3 py-1">
              <HugeiconsIcon icon={AlertCircleIcon} size={18} class="text-destructive shrink-0 mt-0.5" />
              <p class="text-sm text-destructive">{redeemError}</p>
            </div>
          {/if}
          {#if redeemSuccess}
            <div transition:fade={{ duration: 200 }} class="flex items-start gap-3 py-1">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={18} class="text-primary shrink-0 mt-0.5" />
              <p class="text-sm font-medium text-foreground">{redeemSuccess}</p>
            </div>
          {/if}
        {/if}
      </div>
    </div>

    <!-- About -->
    <div class="bg-card border border-border/60 p-6 shadow-sm rounded-2xl">
      <div class="flex items-center gap-2 border-b border-border/50 pb-4 mb-6">
        <HugeiconsIcon icon={AlertCircleIcon} size={18} class="text-muted-foreground" />
        <h3 class="font-semibold text-foreground text-sm">How billing works</h3>
      </div>
      <div class="space-y-3 text-sm text-muted-foreground leading-relaxed max-w-2xl">
        <p>Plus costs ₹199/month and Pro costs ₹349/month. Both renew automatically every month, and you can cancel anytime — you'll keep access until {isLifetime() ? 'you cancel' : periodEnd() ? formatDate(periodEnd()!) : 'the end of the current period'}.</p>
        <p>Need Pro for just a few days? The Weekly Pass gives full Pro access for 7 days at ₹79/week.</p>
        <p>Gift codes grant free access with no expiry date.</p>
      </div>
    </div>
  {/if}
</div>

<!-- Cancel Confirmation Modal -->
<Modal bind:isOpen={showCancelModal} title="Cancel Subscription">
  <div class="space-y-5">
    <p class="text-sm text-muted-foreground leading-relaxed">
      {#if isLifetime()}
        Cancel your lifetime <span class="font-semibold text-foreground">{effectivePlan()}</span> plan?
        You'll lose access to all premium features immediately.
      {:else}
        Cancel auto-renewal for your <span class="font-semibold text-foreground">{effectivePlan()}</span> plan?
        You'll keep access until <span class="font-semibold text-foreground">{periodEnd() ? formatDate(periodEnd()!) : 'the end of the billing period'}</span>.
      {/if}
    </p>
    {#if !isLifetime()}
    <label class="flex items-start gap-3 text-sm text-muted-foreground cursor-pointer">
      <input type="checkbox" bind:checked={cancelImmediate} class="mt-1 accent-current" />
      <span>End my access immediately instead (lose remaining days)</span>
    </label>
    {/if}
    {#if cancelError}
      <Alert type="error" message={cancelError} />
    {/if}
    <div class="flex justify-end gap-3 pt-4 border-t border-border/50">
      <button class="btn-base btn-secondary" onclick={() => showCancelModal = false}>Keep Plan</button>
      <button class="btn-base btn-destructive" onclick={confirmCancel} disabled={isCancelling}>
        {#if isCancelling}<HugeiconsIcon icon={Loading01Icon} size={16} class="animate-spin" />{/if}
        {isLifetime() ? 'Cancel Plan' : cancelImmediate ? 'Cancel Immediately' : 'Turn Off Renewal'}
      </button>
    </div>
  </div>
</Modal>

<!-- Super User Transfer Modal -->
<Modal bind:isOpen={showTransferModal} title="Transfer Admin Privileges">
  <div class="space-y-5">
    <div>
      <h4 class="font-semibold text-foreground">Super users can't cancel directly</h4>
      <p class="text-sm text-muted-foreground mt-1 leading-relaxed">
        You must first choose a successor to pass admin privileges to. The successor will receive an email notification about their promotion. Alternatively, another admin can revoke your access.
      </p>
    </div>
    <div class="space-y-3">
      <label for="successor-username" class="block text-sm font-medium text-foreground">Successor Username</label>
      <input
        id="successor-username"
        type="text"
        bind:value={successorUsername}
        placeholder="Enter username of the new admin"
        disabled={isTransferring}
        class="w-full px-4 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background transition-all"
        onkeydown={(e) => { if (e.key === 'Enter') confirmTransfer(); }}
      />
      <p class="text-xs text-muted-foreground">This user will be granted full admin access to Materio.</p>
    </div>
    {#if transferError}
      <Alert type="error" message={transferError} />
    {/if}
    <div class="flex justify-end gap-3 pt-4 border-t border-border/50">
      <button class="btn-base btn-secondary" onclick={() => { showTransferModal = false; transferError = ''; successorUsername = ''; }}>Cancel</button>
      <button class="btn-base btn-destructive" onclick={confirmTransfer} disabled={isTransferring || !successorUsername.trim()}>
        {#if isTransferring}<HugeiconsIcon icon={Loading01Icon} size={16} class="animate-spin" />{/if}
        <HugeiconsIcon icon={UserIcon} size={16} />
        Transfer & Cancel
      </button>
    </div>
  </div>
</Modal>
