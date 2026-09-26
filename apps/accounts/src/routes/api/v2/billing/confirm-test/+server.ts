import { json } from '@sveltejs/kit';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';
import { env } from '$env/dynamic/private';
import { buildActivationUpdate, getPlanById, RAZORPAY_TEST_CARD } from '$lib/server/billing';

/**
 * POST /api/v2/billing/confirm-test { plan, sessionId?, cardNumber?, last4? }
 * TEST MODE ONLY (returns 403 once RAZORPAY_KEY_ID/SECRET are configured).
 * Simulates a successful test payment for the custom pay screen:
 * activates the monthly tier (Plus -> is_lite_user, Pro -> is_plus_user)
 * with lite_expiry = +30 days and records a mock payment row.
 */
export async function POST({ request }: any) {
  try {
    if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
      return json({ error: 'Test confirmation is disabled once live provider keys are configured' }, { status: 403 });
    }
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
    if (!token) return json({ error: 'Unauthorized' }, { status: 401 });
    const decoded: any = await verifyToken(token);
    if (!decoded) return json({ error: 'Invalid or expired token' }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as any;
    const plan = getPlanById(body.plan);
    if (!plan) return json({ error: "Invalid plan. Use 'plus' or 'pro'." }, { status: 400 });

    const last4 = String(body.last4 || '4366').replace(/\D/g, '').slice(-4) || '4366';
    const method = body.method === 'upi' ? 'upi' : 'card';
    const upiId = String(body.upiId || '').trim();
    if (method === 'upi') {
      if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upiId)) {
        return json({ error: 'Enter a valid UPI ID' }, { status: 400 });
      }
    } else {
      const digits = String(body.cardNumber || '').replace(/\D/g, '');
      if (body.cardNumber && !(digits.startsWith('4718') || digits.startsWith('4111') || digits.startsWith('42'))) {
        return json({ error: `Test mode only accepts the ${RAZORPAY_TEST_CARD} test card` }, { status: 402 });
      }
    }

    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, has_admin_privileges')
      .eq('id', decoded.id)
      .single();
    if (userErr || !user) return json({ error: 'User not found' }, { status: 404 });
    if ((user as any).has_admin_privileges) return json({ error: 'Super users already have full access' }, { status: 409 });

    const sessionId = body.sessionId || `rzp_test_mock_${plan.id}_${Date.now()}`;
    const subscriptionId = `sub_test_mock_${plan.id}_${Date.now()}`;
    const customerId = `cust_test_mock_${String(decoded.id).slice(0, 8)}`;
    const update = buildActivationUpdate(plan, { customerId, subscriptionId, orderId: sessionId });
    (update as any).last_invoice_id = `pay_test_mock_${Date.now()}`;

    const { error: updateErr } = await supabaseAdmin.from('users').update(update).eq('id', decoded.id);
    if (updateErr) return json({ error: 'Failed to activate subscription', details: updateErr.message }, { status: 500 });

    try {
      await supabaseAdmin.from('payments').insert({
        user_id: decoded.id,
        plan: plan.id,
        amount_paise: plan.pricePaise,
        currency: 'inr',
        status: 'succeeded',
        provider: 'razorpay',
        provider_order_id: sessionId,
        provider_subscription_id: subscriptionId,
        provider_payment_id: (update as any).last_invoice_id,
        period_start: new Date().toISOString(),
        period_end: update.lite_expiry
      });
    } catch {}

    return json({
      success: true,
      testMode: true,
      provider: 'razorpay',
      plan: plan.id,
      expiry: update.lite_expiry,
      last4,
      message: method === 'upi'
        ? `Welcome to ${plan.fullLabel}! (test payment via UPI)`
        : `Welcome to ${plan.fullLabel}! (test payment, card ending ${last4})`
    });
  } catch (e: any) {
    return json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
