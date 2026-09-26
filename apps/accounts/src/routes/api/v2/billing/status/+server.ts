import { corsJson as J, handleOptions } from '$lib/server/cors';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';
import {
  BILLING_PLANS,
  buildDeactivationUpdate,
  isExpired,
  resolveEffectivePlan
} from '$lib/server/billing';
import { razorpayKeys } from '$lib/server/razorpay';

export async function OPTIONS({ request }: any) {
  return handleOptions(request);
}

const FULL_SELECT =
  'id, username, email, is_plus_user, is_lite_user, has_admin_privileges, lite_expiry, provider, provider_customer_id, provider_subscription_id, provider_order_id, subscription_plan, subscription_status, subscription_current_period_end, last_payment_at, last_invoice_id';
const BASE_SELECT = 'id, username, email, is_plus_user, is_lite_user, has_admin_privileges, lite_expiry';

async function fetchUser(userId: string): Promise<{ user: any; full: boolean; error?: any }> {
  const full = await supabaseAdmin.from('users').select(FULL_SELECT).eq('id', userId).single();
  if (!full.error && full.data) return { user: full.data as any, full: true };
  const base = await supabaseAdmin.from('users').select(BASE_SELECT).eq('id', userId).single();
  return { user: base.data as any, full: false, error: base.error };
}

/**
 * GET /api/v2/billing/status
 * Returns effective plan (expiry-aware; lifetime grants never expire),
 * subscription + billing details + invoice history. Lazy-expires stale
 * monthly rows.
 */
export async function GET({ request }: any) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
    if (!token) return J(request, { error: 'Unauthorized' }, 401);
    const decoded: any = await verifyToken(token);
    if (!decoded) return J(request, { error: 'Invalid or expired token' }, 401);

    const { user, full } = await fetchUser(decoded.id);
    if (!user) return J(request, { error: 'User not found' }, 404);
    const u: any = user;

    // Lazy expiry: a MONTHLY tier with past lite_expiry loses access.
    // Lifetime grants (paid flags, null expiry — invite codes / admin) never expire.
    let expired = false;
    const lifetime = !u.has_admin_privileges && (u.is_plus_user || u.is_lite_user) && !u.lite_expiry;
    if (!u.has_admin_privileges && (u.is_plus_user || u.is_lite_user) && u.lite_expiry && isExpired(u.lite_expiry)) {
      expired = true;
      if (full) {
        await supabaseAdmin.from('users').update(buildDeactivationUpdate()).eq('id', u.id);
        u.is_plus_user = false;
        u.is_lite_user = false;
        u.lite_expiry = null;
        u.subscription_plan = null;
        u.subscription_status = 'expired';
      } else {
        u.is_plus_user = false;
        u.is_lite_user = false;
      }
    }

    const effective = resolveEffectivePlan(expired ? { ...u, is_plus_user: false, is_lite_user: false } : u);
    const planKey = effective === 'pro' ? 'pro' : effective === 'plus' ? 'plus' : null;
    const plan = planKey ? BILLING_PLANS[planKey] : null;

    let invoices: any[] = [];
    if (full) {
      const { data } = await supabaseAdmin
        .from('payments')
        .select('id, plan, amount_paise, currency, status, provider, provider_payment_id, provider_subscription_id, period_start, period_end, created_at')
        .eq('user_id', u.id)
        .order('created_at', { ascending: false })
        .limit(12);
      if (data) invoices = data;
    }

    const { configured, keyId } = razorpayKeys();

    return J(request, {
      provider: 'razorpay',
      plan: effective ?? 'free',
      isPlusUser: effective === 'pro',
      isLiteUser: effective === 'plus',
      hasAdminPrivileges: Boolean(u.has_admin_privileges),
      expiry: u.lite_expiry ?? null,
      expired,
      lifetime,
      subscription: full
        ? {
            plan: u.subscription_plan ?? planKey,
            status: lifetime ? 'lifetime' : expired ? 'expired' : (u.subscription_status ?? (planKey ? 'active' : null)),
            periodEnd: u.subscription_current_period_end ?? u.lite_expiry ?? null,
            customerId: u.provider_customer_id ?? null,
            subscriptionId: u.provider_subscription_id ?? null,
            orderId: u.provider_order_id ?? null,
            lastPaymentAt: u.last_payment_at ?? null
          }
        : { plan: planKey, status: lifetime ? 'lifetime' : planKey ? 'active' : null, periodEnd: u.lite_expiry ?? null },
      currentPlan: plan
        ? { id: plan.id, label: plan.fullLabel, priceInr: plan.priceInr, interval: plan.interval, days: plan.days }
        : null,
      invoices,
      testMode: !configured,
      keyId: configured ? keyId : null
    });
  } catch (e: any) {
    return J(request, { error: 'Internal server error', details: e?.message }, 500);
  }
}
