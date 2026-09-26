import { corsJson as J, handleOptions } from '$lib/server/cors';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';
import { env } from '$env/dynamic/private';
import { getPlanById } from '$lib/server/billing';
import { razorpayKeys, ensureRazorpayPlan, createRazorpaySubscription } from '$lib/server/razorpay';

export async function OPTIONS({ request }: any) {
  return handleOptions(request);
}

function getBearer(request: Request): string {
  return request.headers.get('authorization')?.replace('Bearer ', '') || '';
}

function getOrigin(request: Request): string {
  const origin = request.headers.get('origin') || '';
  if (origin) return origin.replace(/\/$/, '');
  const referer = request.headers.get('referer') || '';
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {}
  }
  return env.PUBLIC_SITE_URL || env.SITE_URL || 'https://accounts.getmaterio.app';
}

/**
 * POST /api/v2/billing/checkout { plan: 'plus' | 'pro' | 'weekly' }
 * Creates a recurring Razorpay subscription (auto-renew). Returns
 * { subscriptionId, keyId } for the styled Checkout.js modal
 * (UPI-first ordering, Materio theme, locked backdrop).
 * Test mode (no RAZORPAY_KEY_ID/SECRET): returns a mock payload routed to
 * the custom /upgrade/pay test screen.
 */
export async function POST({ request }: any) {
  try {
    const token = getBearer(request);
    if (!token) return J(request, { error: 'Unauthorized' }, 401);
    const decoded: any = await verifyToken(token);
    if (!decoded) return J(request, { error: 'Invalid or expired token' }, 401);

    const body = (await request.json().catch(() => ({}))) as any;
    const plan = getPlanById(body.plan);
    if (!plan) return J(request, { error: "Invalid plan. Use 'plus', 'pro' or 'weekly'." }, 400);

    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, email, is_plus_user, is_lite_user, has_admin_privileges, lite_expiry, provider_customer_id, subscription_plan, subscription_status')
      .eq('id', decoded.id)
      .single();

    if (userErr || !user) return J(request, { error: 'User not found' }, 404);
    if (user.has_admin_privileges) return J(request, { error: 'Super users already have full access' }, 409);

    // Lifetime grants (invite codes) must not be overwritten by monthly billing.
    if ((user.is_plus_user || user.is_lite_user) && !user.lite_expiry) {
      return J(request, { error: 'You already have lifetime access — cancel it first if you want monthly billing instead' }, 409);
    }

    // Block duplicate active purchase of the same tier (still expiring, not forever).
    const activeSameTier =
      user.subscription_plan === plan.id &&
      user.subscription_status !== 'cancelled' &&
      user.lite_expiry &&
      new Date(user.lite_expiry).getTime() > Date.now();
    if (activeSameTier) return J(request, { error: `You already have an active ${plan.fullLabel} subscription` }, 409);

    // Guard: monthly Pro must not be overwritten by a 7-day Weekly Pass.
    const activeMonthlyPro =
      user.subscription_plan === 'pro' &&
      user.subscription_status !== 'cancelled' &&
      user.lite_expiry &&
      new Date(user.lite_expiry).getTime() > Date.now();
    if (activeMonthlyPro && plan.id === 'weekly') {
      return J(request, { error: 'You are already on monthly Pro — the Weekly Pass would shorten your access' }, 409);
    }

    const { configured, keyId } = razorpayKeys();
    const origin = getOrigin(request);

    // ---- Test mode: no Razorpay keys yet ----
    if (!configured) {
      const sessionId = `rzp_test_mock_${plan.id}_${Date.now()}`;
      return J(request, {
        provider: 'razorpay',
        sessionId,
        url: `${origin}/upgrade/pay?plan=${plan.id}&session=${sessionId}`,
        testMode: true,
        plan: plan.id,
        amountInr: plan.priceInr,
        message: 'Razorpay test mode — complete payment on the test screen with card 4718 6091 0820 4366.'
      });
    }

    // ---- Live / Razorpay test-keys mode: real recurring subscription ----
    try {
      const rzpPlanId = await ensureRazorpayPlan(plan.id, plan.fullLabel, plan.pricePaise, plan.interval === 'week' ? 'weekly' : 'monthly');
      const sub = await createRazorpaySubscription(rzpPlanId, user.id, plan.id, user.email);
      return J(request, {
        provider: 'razorpay',
        sessionId: sub.id,
        subscriptionId: sub.id,
        keyId,
        testMode: false,
        plan: plan.id,
        amountInr: plan.priceInr
      });
    } catch (e: any) {
      const raw = e?.message || 'Failed to create Razorpay subscription';
      const isAuth = /authenticat|401|unauthorized/i.test(raw);
      return J(request, {
        error: isAuth
          ? 'Payment provider rejected the API keys. Re-copy RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET from the Razorpay dashboard (Test mode) into the accounts .env and restart.'
          : raw
      }, 502);
    }
  } catch (e: any) {
    return J(request, { error: 'Internal server error', details: e?.message }, 500);
  }
}
