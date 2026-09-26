import { env } from '$env/dynamic/private';
import crypto from 'node:crypto';

/**
 * Minimal Razorpay REST adapter (no SDK dependency).
 * Auth: HTTP Basic with key_id:key_secret. All amounts in paise (INR).
 */

const API_BASE = 'https://api.razorpay.com/v1';

export function razorpayKeys() {
  const keyId = (env.RAZORPAY_KEY_ID || env.PUBLIC_RAZORPAY_KEY_ID || '').trim();
  const keySecret = (env.RAZORPAY_KEY_SECRET || '').trim();
  return { keyId, keySecret, configured: Boolean(keyId && keySecret) };
}

function authHeader() {
  const { keyId, keySecret } = razorpayKeys();
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

export async function rzpFetch(path: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: init?.method || 'GET',
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json'
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.description || data?.error?.code || `Razorpay API error (${res.status})`);
  }
  return data;
}

/** Dashboard plan id for a tier, or null when it must be created on the fly. */
export function rzpPlanIdFor(planId: 'plus' | 'pro' | 'weekly'): string {
  if (planId === 'plus') return env.RAZORPAY_PLAN_PLUS || '';
  if (planId === 'weekly') return env.RAZORPAY_PLAN_WEEKLY || '';
  return env.RAZORPAY_PLAN_PRO || '';
}

/** Ensure a Razorpay plan exists for the tier; returns the plan id. */
export async function ensureRazorpayPlan(planId: 'plus' | 'pro' | 'weekly', name: string, amountPaise: number, period: 'monthly' | 'weekly' = 'monthly'): Promise<string> {
  const existing = rzpPlanIdFor(planId);
  if (existing) return existing;
  const plan = await rzpFetch('/plans', {
    method: 'POST',
    body: {
      period,
      interval: 1,
      item: { name, amount: amountPaise, currency: 'INR', description: `${name} — ${period} subscription` },
      notes: { materio_plan: planId }
    }
  });
  return plan.id;
}

/** Create a Razorpay subscription (auto-renewing, 120 cycles). Auth link expires in 24h. */
export async function createRazorpaySubscription(planRzpId: string, userId: string, planId: 'plus' | 'pro' | 'weekly', email?: string | null) {
  return rzpFetch('/subscriptions', {
    method: 'POST',
    body: {
      plan_id: planRzpId,
      customer_notify: 1,
      quantity: 1,
      total_count: 120,
      expire_by: Math.floor(Date.now() / 1000) + 86400,
      notes: { userId: String(userId), plan: planId, email: email || '' }
    }
  });
}

/** Cancel a Razorpay subscription. cycleEnd=true keeps it till the cycle ends. */
export async function cancelRazorpaySubscription(subscriptionId: string, cycleEnd: boolean) {
  return rzpFetch(`/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
    method: 'POST',
    body: { cancel_at_cycle_end: cycleEnd ? 1 : 0 }
  });
}

/** Verify a Razorpay webhook payload against x-razorpay-signature. */
export function verifyRazorpayWebhook(raw: string, signature: string): boolean {
  const secret = env.RAZORPAY_WEBHOOK_SECRET || '';
  if (!secret || !signature) return false;
  try {
    const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
