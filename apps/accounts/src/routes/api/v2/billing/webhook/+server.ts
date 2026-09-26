import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/utils';
import { env } from '$env/dynamic/private';
import { BILLING_PLANS, buildActivationUpdate, buildDeactivationUpdate, calcPeriodEnd, getPlanById } from '$lib/server/billing';
import { verifyRazorpayWebhook } from '$lib/server/razorpay';

async function recordPayment(row: Record<string, unknown>) {
  try {
    await supabaseAdmin.from('payments').insert(row);
  } catch {
    // payments table may not exist until migration 003 runs — never fail the webhook.
  }
}

function periodEndFrom(entity: any): string {
  // Razorpay subscription entity carries current_end as a unix timestamp.
  const ts = entity?.current_end || entity?.expire_by;
  if (ts && Number(ts) > 0) {
    const d = new Date(Number(ts) * 1000);
    if (d.getTime() > Date.now()) return d.toISOString();
  }
  return calcPeriodEnd();
}

async function findUserId(subscriptionId: string | null, notesUserId?: string | null): Promise<string | null> {
  if (notesUserId) return notesUserId;
  if (!subscriptionId) return null;
  try {
    const { data } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('provider_subscription_id', subscriptionId)
      .maybeSingle();
    return (data as any)?.id ?? null;
  } catch {
    return null;
  }
}

async function activateUser(
  userId: string,
  planId: string,
  rzp: { customer?: string | null; subscription?: string | null; order?: string | null; payment?: string | null; invoice?: string | null },
  periodEnd?: string
) {
  const plan = getPlanById(planId);
  if (!plan || !userId) return false;
  const end = periodEnd ?? calcPeriodEnd();
  const update = buildActivationUpdate(plan, {
    periodEnd: end,
    customerId: rzp.customer ?? null,
    subscriptionId: rzp.subscription ?? null,
    orderId: rzp.order ?? null
  });
  if (rzp.payment) (update as any).last_invoice_id = rzp.payment;
  else if (rzp.invoice) (update as any).last_invoice_id = rzp.invoice;
  const { error } = await supabaseAdmin.from('users').update(update).eq('id', userId);
  if (error) return false;
  await recordPayment({
    user_id: userId,
    plan: plan.id,
    amount_paise: plan.pricePaise,
    currency: 'inr',
    status: 'succeeded',
    provider: 'razorpay',
    provider_order_id: rzp.order ?? null,
    provider_subscription_id: rzp.subscription ?? null,
    provider_payment_id: rzp.payment ?? null,
    provider_invoice_id: rzp.invoice ?? null,
    period_start: new Date().toISOString(),
    period_end: end
  });
  return true;
}

/**
 * POST /api/v2/billing/webhook
 * Razorpay webhook (x-razorpay-signature verified when RAZORPAY_WEBHOOK_SECRET
 * is set). Handles subscription.activated / subscription.charged (activate +
 * extend 30 days), subscription.cancelled (renewal off, access kept till
 * period end), subscription.completed/expired/halted (access ends).
 *
 * Test-mode helper: accepts { testUserId, testPlan } WITHOUT a signature
 * ONLY when no webhook secret is configured, so the custom test screen can
 * simulate subscription.charged locally.
 */
export async function POST({ request }: any) {
  const raw = await request.text();
  const signature = request.headers.get('x-razorpay-signature') || '';
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET || '';

  let event: any = null;
  try {
    event = raw ? JSON.parse(raw) : {};
  } catch {
    return json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (webhookSecret) {
    if (!verifyRazorpayWebhook(raw, signature)) {
      return json({ error: 'Invalid signature' }, { status: 400 });
    }
  } else if (event?.testUserId && event?.testPlan) {
    // Local test-mode activation (no keys configured yet).
    const ok = await activateUser(event.testUserId, String(event.testPlan).toLowerCase(), {
      customer: event.testCustomer ?? `cust_test_mock_${Date.now()}`,
      subscription: event.testSubscription ?? `sub_test_mock_${Date.now()}`,
      order: event.testSession ?? null
    });
    if (!ok) return json({ error: 'Failed to activate test subscription' }, { status: 500 });
    return json({ received: true, testMode: true });
  }

  const type = event.event || event.type || '';
  const subEntity = event.payload?.subscription?.entity ?? {};
  const payEntity = event.payload?.payment?.entity ?? {};
  const orderEntity = event.payload?.order?.entity ?? {};

  try {
    if (type === 'subscription.activated' || type === 'subscription.charged') {
      const notes = subEntity.notes ?? {};
      const planId = String(notes.plan || '').toLowerCase();
      const userId = await findUserId(subEntity.id ?? null, notes.userId || null);
      let resolvedPlan = getPlanById(planId);
      if (!resolvedPlan && userId) {
        const { data } = await supabaseAdmin
          .from('users')
          .select('subscription_plan')
          .eq('id', userId)
          .maybeSingle();
        resolvedPlan = getPlanById((data as any)?.subscription_plan);
      }
      if (userId && resolvedPlan) {
        await activateUser(userId, resolvedPlan.id, {
          customer: subEntity.customer_id ?? null,
          subscription: subEntity.id ?? null,
          order: orderEntity.id ?? null,
          payment: payEntity.id ?? null
        }, periodEndFrom(subEntity));
      }
    } else if (type === 'subscription.cancelled') {
      // Renewal off — keep access until the current period ends.
      const subId = subEntity.id;
      if (subId) {
        await supabaseAdmin
          .from('users')
          .update({ subscription_status: 'cancel_at_period_end' })
          .eq('provider_subscription_id', subId);
      }
    } else if (type === 'subscription.completed' || type === 'subscription.expired' || type === 'subscription.halted') {
      const subId = subEntity.id;
      if (subId) {
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('provider_subscription_id', subId)
          .maybeSingle();
        if (user) await supabaseAdmin.from('users').update(buildDeactivationUpdate()).eq('id', (user as any).id);
      }
    }
    // subscription.paused/resumed/updated, payment.failed etc: no access change.
  } catch (e: any) {
    return json({ error: 'Webhook handler failed', details: e?.message }, { status: 500 });
  }

  return json({ received: true });
}
