/**
 * Shared billing plan config — single source of truth for Plus / Pro.
 *
 * Mapping (must stay in sync with landing + svelte app):
 * - Plus (UI)  -> DB `is_lite_user = true`  + `lite_expiry` = +30 days (monthly)
 * - Pro (UI)   -> DB `is_plus_user = true`  + `lite_expiry` = +30 days (monthly)
 * - Lifetime   -> paid flags with `lite_expiry = null` (invite codes / admin only)
 *
 * Provider: Razorpay (subscriptions, auto-renew). The users/payments tables
 * use provider-neutral columns (`provider`, `provider_*`) so a future
 * provider switch only touches the adapter code, not the schema.
 */

export const BILLING_PROVIDER = 'razorpay';
export const BILLING_CURRENCY = 'inr';

/** Test card hint for the local mock screen (no-keys mode only). */
export const RAZORPAY_TEST_CARD = '4718 6091 0820 4366';

export interface BillingPlan {
  id: 'plus' | 'pro' | 'weekly';
  /** UI label */
  label: string;
  /** Full label */
  fullLabel: string;
  /** Price in INR (major units) */
  priceInr: number;
  /** Price in paise (minor units, for the provider) */
  pricePaise: number;
  interval: 'month' | 'week';
  /** Access duration granted per payment, in days */
  days: number;
  /** Which DB flag this plan sets */
  dbFlag: 'is_lite_user' | 'is_plus_user';
  features: string[];
}

export const BILLING_PLANS: Record<'plus' | 'pro' | 'weekly', BillingPlan> = {
  plus: {
    id: 'plus',
    label: 'Plus',
    fullLabel: 'Materio Plus',
    priceInr: 199,
    pricePaise: 19900,
    interval: 'month',
    days: 30,
    dbFlag: 'is_lite_user',
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
    label: 'Pro',
    fullLabel: 'Materio Pro',
    priceInr: 349,
    pricePaise: 34900,
    interval: 'month',
    days: 30,
    dbFlag: 'is_plus_user',
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
    fullLabel: 'Materio Pro · Weekly Pass',
    priceInr: 79,
    pricePaise: 7900,
    interval: 'week',
    days: 7,
    dbFlag: 'is_plus_user',
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
};

export type PlanId = keyof typeof BILLING_PLANS;

export function getPlanById(planId: string | null | undefined): BillingPlan | null {
  if (!planId) return null;
  const key = planId.toLowerCase() as PlanId;
  return BILLING_PLANS[key] ?? null;
}

/** Period end: now + plan.days (paid tiers are never forever). */
export function calcPeriodEnd(from: Date = new Date(), days = 30): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function isExpired(liteExpiry: string | null | undefined): boolean {
  if (!liteExpiry) return true;
  return new Date(liteExpiry).getTime() <= Date.now();
}

export interface UserSubRow {
  is_plus_user?: boolean | null;
  is_lite_user?: boolean | null;
  has_admin_privileges?: boolean | null;
  lite_expiry?: string | null;
  subscription_plan?: string | null;
  subscription_status?: string | null;
}

/** Resolve effective UI plan, respecting monthly expiry. Admins are `super`. */
export function resolveEffectivePlan(user: UserSubRow | null | undefined): 'super' | 'pro' | 'plus' | null {
  if (!user) return null;
  if (user.has_admin_privileges) return 'super';
  // Lifetime grants (invite codes / admin grants) carry NO expiry — never expire.
  if (!user.lite_expiry) {
    if (user.is_plus_user) return 'pro';
    if (user.is_lite_user) return 'plus';
    return null;
  }
  if (isExpired(user.lite_expiry)) return null;
  if (user.is_plus_user) return 'pro';
  if (user.is_lite_user) return 'plus';
  return null;
}

/**
 * True when the user holds a lifetime (forever) grant: paid flags with no
 * expiry. Only invite-code redemptions and admin grants create these —
 * provider purchases always set lite_expiry.
 */
export function isLifetimeGrant(user: UserSubRow | null | undefined): boolean {
  if (!user || user.has_admin_privileges) return false;
  return Boolean((user.is_plus_user || user.is_lite_user) && !user.lite_expiry);
}

/**
 * Build the users-row update for a successful payment / renewal.
 * Always sets lite_expiry to +30 days — provider tiers are never forever.
 * (Forever access is granted ONLY via invite-code redemption, which sets
 * subscription_status = 'lifetime' with lite_expiry = null.)
 */
export function buildActivationUpdate(plan: BillingPlan, opts?: { periodEnd?: string; customerId?: string | null; subscriptionId?: string | null; orderId?: string | null }) {
  const periodEnd = opts?.periodEnd ?? calcPeriodEnd(new Date(), plan.days);
  const base: Record<string, unknown> = {
    is_plus_user: false,
    is_lite_user: false,
    lite_expiry: periodEnd,
    provider: BILLING_PROVIDER,
    subscription_plan: plan.id,
    subscription_status: 'active',
    subscription_current_period_end: periodEnd,
    last_payment_at: new Date().toISOString()
  };
  base[plan.dbFlag] = true;
  if (opts?.customerId) base.provider_customer_id = opts.customerId;
  if (opts?.subscriptionId) base.provider_subscription_id = opts.subscriptionId;
  if (opts?.orderId) base.provider_order_id = opts.orderId;
  return base;
}

/** Build the users-row update for cancel-at-period-end (keep access till expiry). */
export function buildCancelAtPeriodEndUpdate() {
  return { subscription_status: 'cancel_at_period_end' };
}

/** Build the users-row update when access fully ends (expiry / immediate cancel). */
export function buildDeactivationUpdate() {
  return {
    is_plus_user: false,
    is_lite_user: false,
    lite_expiry: null,
    provider: null,
    provider_subscription_id: null,
    provider_order_id: null,
    subscription_plan: null,
    subscription_status: 'cancelled',
    subscription_current_period_end: null
  };
}
