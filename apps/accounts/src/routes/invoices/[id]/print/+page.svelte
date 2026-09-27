<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getAppUrls, getClientCookie, setClientCookie } from '@materio/config';
  import { userStore } from '$lib/stores/user.svelte';
  import ToastProvider from '$lib/components/ToastProvider.svelte';

  const PLAN_NAMES: Record<string, string> = { plus: 'Materio Plus', pro: 'Materio Pro', weekly: 'Weekly Pass' };
  const PLAN_PRICES: Record<string, number> = { plus: 19900, pro: 34900, weekly: 7900 };

  let loading = $state(true);
  let inv = $state<any>(null);
  let notFound = $state(false);

  function authToken() {
    return localStorage.getItem('token') || getClientCookie('materio_token') || '';
  }

  function loginRedirect() {
    const urls = getAppUrls(window.location.origin);
    const next = window.location.pathname;
    window.location.href = `${urls.auth}/login?callback=${encodeURIComponent(window.location.origin + '/auth/callback?next=' + encodeURIComponent(next))}`;
  }

  function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function fmtRs(paise: number): string {
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function monthRange(iso: string | null): string | null {
    if (!iso) return null;
    const base = new Date(iso);
    if (Number.isNaN(base.getTime())) return null;
    const f = (x: Date) => x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    return `${f(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1)))} – ${f(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)))}`;
  }

  function rangeLabel(s: string | null, e: string | null): string | null {
    if (!s || !e) return null;
    const f = (iso: string) => {
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    const a = f(s);
    const b = f(e);
    return a && b ? `${a} – ${b}` : null;
  }

  let planName = $derived(inv?.plan && PLAN_NAMES[inv.plan] ? PLAN_NAMES[inv.plan] : 'Materio subscription');
  let isGift = $derived(Boolean(inv?.isGift));
  let unitPaise = $derived(
    isGift && inv?.plan && PLAN_PRICES[inv.plan] ? PLAN_PRICES[inv.plan] : (inv?.amountPaise ?? 0)
  );
  let periodLabel = $derived(
    rangeLabel(inv?.periodStart, inv?.periodEnd) ||
      (isGift ? monthRange(inv?.periodStart || inv?.date) : null) ||
      (inv?.plan === 'weekly' ? '7 days of Pro' : 'Monthly billing')
  );
  let paidish = $derived(/^(paid|success|succeeded)$/i.test(inv?.status || ''));
  let fileStamp = $derived(() => {
    const d = inv?.date ? new Date(inv.date) : new Date();
    return Number.isNaN(d.getTime()) ? 'receipt' : d.toISOString().slice(0, 10);
  });

  function doPrint() {
    document.title = `materio-invoice-${fileStamp()}`;
    window.print();
  }

  onMount(async () => {
    const token = authToken();
    if (!token) {
      loginRedirect();
      return;
    }
    localStorage.setItem('token', token);
    try {
      const [profRes, invRes] = await Promise.all([
        fetch('/api/v2/profile', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/v2/billing/invoices', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (profRes.status === 401 || invRes.status === 401) {
        loginRedirect();
        return;
      }
      if (profRes.ok) {
        const pdata = (await profRes.json()) as any;
        if (pdata?.user) userStore.setUser(pdata.user);
      }
      const id = $page.url.pathname.split('/invoices/')[1]?.split('/')[0] || '';
      if (invRes.ok) {
        const data = (await invRes.json()) as any;
        inv = (data.invoices || []).find((r: any) => String(r.id) === id) || null;
      }
      if (!inv) notFound = true;
      else setTimeout(() => window.print(), 600);
    } catch {
      notFound = true;
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>Invoice · Materio ID</title>
</svelte:head>

<div class="min-h-screen bg-background text-foreground font-sans print:bg-white print:min-h-0">
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-8 print:p-0 print:max-w-none">
    <div class="flex items-center justify-between mb-6 print:hidden">
      <button onclick={() => goto('/upgrade')} class="text-sm text-muted-foreground hover:text-foreground transition-colors">
        ← Back to Payments
      </button>
      {#if inv}
        <button onclick={doPrint} class="btn-base btn-secondary">Print / Save PDF</button>
      {/if}
    </div>

    {#if loading}
      <div class="bg-card border border-border/60 rounded-2xl p-10 text-center text-sm text-muted-foreground">
        Loading invoice…
      </div>
    {:else if !inv}
      <div class="bg-card border border-border/60 rounded-2xl p-10 text-center space-y-3">
        <p class="font-semibold">Invoice not found</p>
        <button onclick={() => goto('/upgrade')} class="btn-base btn-secondary mx-auto">Back to Payments</button>
      </div>
    {:else}
      <!-- Paper sheet (always light, screen + print) -->
      <div class="bg-white text-neutral-900 rounded-2xl border border-black/10 shadow-sm p-8 sm:p-12 print:shadow-none print:border-0 print:rounded-none print:p-0">
        <div class="flex items-start justify-between">
          <h1 class="text-[28px] font-bold tracking-tight" style="font-family: 'OpenRunde', sans-serif;">Invoice</h1>
          <img src="/sticker.png" alt="Materio" class="h-6 w-auto object-contain" />
        </div>
        <div class="mt-1 mb-7 h-[2px] w-full" style="background: #EB5E28;"></div>

        <div class="space-y-[7px] text-[13px]">
          <div class="flex gap-2"><span class="text-neutral-500 w-28 shrink-0">Invoice number</span><span class="font-semibold">{inv.invoiceNumber || String(inv.id).slice(0, 8).toUpperCase()}</span></div>
          <div class="flex gap-2"><span class="text-neutral-500 w-28 shrink-0">Date of issue</span><span class="font-semibold">{fmtDate(inv.date)}</span></div>
          <div class="flex gap-2"><span class="text-neutral-500 w-28 shrink-0">Date due</span><span class="font-semibold">{fmtDate(inv.date)}</span></div>
          {#if inv.paymentId}<div class="flex gap-2"><span class="text-neutral-500 w-28 shrink-0">Payment ID</span><span class="font-semibold">{inv.paymentId}</span></div>{/if}
          {#if inv.subscriptionId}<div class="flex gap-2"><span class="text-neutral-500 w-28 shrink-0">Subscription</span><span class="font-semibold">{inv.subscriptionId}</span></div>{/if}
          {#if inv.orderId}<div class="flex gap-2"><span class="text-neutral-500 w-28 shrink-0">Order ID</span><span class="font-semibold">{inv.orderId}</span></div>{/if}
        </div>

        <div class="grid grid-cols-2 gap-6 mt-7">
          <div>
            <p class="font-bold text-[15px]">Materio</p>
            <p class="text-[13px] mt-1">support@getmaterio.app</p>
          </div>
          <div>
            <p class="font-bold text-[15px]">Bill to</p>
            <p class="text-[13px] mt-1 break-all">{userStore.user?.email || ''}</p>
          </div>
        </div>

        <p class="text-[19px] font-bold mt-7">{fmtRs(inv.amountPaise)} due {fmtDate(inv.date)}</p>
        <p class="text-[19px] mt-1" style="font-family: 'Quadrant Notepad', 'Quadrant', cursive; color: #EB5E28;">Thanks for subscribing to {planName}!</p>

        <div class="grid grid-cols-[1fr_auto_auto] gap-x-6 items-baseline mt-7 text-[12px] text-neutral-500">
          <span>Description</span><span>Period</span><span class="text-right">Amount</span>
        </div>
        <div class="border-t border-neutral-800 mt-1"></div>
        <div class="grid grid-cols-[1fr_auto_auto] gap-x-6 items-baseline mt-4 text-[13px]">
          <span>{planName}</span><span>{periodLabel}</span><span class="text-right">{fmtRs(inv.amountPaise)}</span>
        </div>
        {#if isGift}
          <div class="grid grid-cols-[1fr_auto_auto] gap-x-6 items-baseline mt-2 text-[13px]">
            <span>Gift Code</span><span></span><span class="text-right">-{fmtRs(unitPaise)}</span>
          </div>
        {/if}

        <div class="flex justify-end mt-6">
          <div class="w-56 space-y-[7px] text-[13px]">
            <div class="flex justify-between"><span>Subtotal</span><span>{fmtRs(inv.amountPaise)}</span></div>
            <div class="flex justify-between"><span>Total</span><span>{fmtRs(inv.amountPaise)}</span></div>
            <div class="flex justify-between font-bold text-[14px]"><span>{paidish ? 'Paid' : 'Amount due'}</span><span>{fmtRs(inv.amountPaise)}</span></div>
          </div>
        </div>

        <div class="mt-10 text-[11px] text-neutral-400 space-y-1">
          <p>support@getmaterio.app · getmaterio.app</p>
          <p>This is a computer-generated receipt and needs no signature.</p>
        </div>
      </div>
    {/if}
  </div>
</div>

<ToastProvider />

<style>
  @media print {
    @page { margin: 14mm; }
  }
</style>
