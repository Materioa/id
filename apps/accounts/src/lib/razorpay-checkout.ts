/**
 * Razorpay Checkout.js loader + modal opener (provider: Razorpay).
 * Test mode never touches this — the custom mock screen handles test cards.
 */

declare global {
  interface Window {
    Razorpay?: any;
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('Failed to load Razorpay Checkout. Check your connection and try again.'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export interface RazorpayOpenOptions {
  keyId: string;
  subscriptionId: string;
  planLabel: string;
  amountInr: number;
  /** 'month' | 'week' — drives the description + renewal wording. */
  interval?: 'month' | 'week';
  email?: string | null;
  name?: string | null;
  /** Absolute origin (https://accounts.getmaterio.app) for the logo URL. */
  origin?: string;
  onSuccess?: (resp: any) => void;
  onDismiss?: () => void;
}

export async function openRazorpayCheckout(opts: RazorpayOpenOptions): Promise<void> {
  await loadRazorpayScript();
  const every = opts.interval === 'week' ? 'week' : 'month';
  const rzp = new window.Razorpay({
    key: opts.keyId,
    subscription_id: opts.subscriptionId,
    name: 'Materio',
    description: `${opts.planLabel} — ₹${opts.amountInr}/${every}, auto-renews`,
    image: opts.origin ? `${opts.origin.replace(/\/$/, '')}/logo-wordmark.webp` : undefined,
    theme: { color: '#EB5E28', backdrop_color: 'rgba(10, 8, 6, 0.72)' },
    prefill: {
      ...(opts.name ? { name: opts.name } : {}),
      ...(opts.email ? { email: opts.email } : {})
    },
    // UPI first (once enabled on the account), then cards — ignored if absent.
    config: { display: { sequence: ['upi', 'card', 'netbanking', 'wallet'] } },
    retry: { enabled: true, max_count: 4 },
    modal: {
      backdropclose: false,
      escape: false,
      animation: true,
      ondismiss: () => opts.onDismiss?.()
    },
    handler: (resp: any) => opts.onSuccess?.(resp)
  });
  rzp.on('payment.failed', (resp: any) => {
    // Surface via dismiss path; the modal stays informative on its own.
    opts.onDismiss?.();
    console.warn('Razorpay payment failed', resp?.error?.description || resp);
  });
  rzp.open();
}

/** Poll billing status until the expected plan is active (webhook round-trip). */
export async function pollBillingForPlan(expected: 'plus' | 'pro' | 'weekly' | null, tries = 10, delayMs = 1500): Promise<any | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch('/api/v2/billing/status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        if (!expected || data?.plan === expected) return data;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}
