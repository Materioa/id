import { corsJson as J, handleOptions } from '$lib/server/cors';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';
import { buildCancelAtPeriodEndUpdate, buildDeactivationUpdate } from '$lib/server/billing';
import { razorpayKeys, cancelRazorpaySubscription } from '$lib/server/razorpay';

export async function OPTIONS({ request }: any) {
  return handleOptions(request);
}

/**
 * POST /api/v2/billing/cancel { immediate?: boolean }
 * Recurring subscriptions cancel AT PERIOD END by default (user keeps access
 * until lite_expiry). immediate:true ends access right away. Lifetime grants
 * (invite codes) have no billing period and cancel immediately.
 */
export async function POST({ request }: any) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
    if (!token) return J(request, { error: 'Unauthorized' }, 401);
    const decoded: any = await verifyToken(token);
    if (!decoded) return J(request, { error: 'Invalid or expired token' }, 401);

    const body = (await request.json().catch(() => ({}))) as any;
    const immediate = body.immediate === true;

    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, is_plus_user, is_lite_user, has_admin_privileges, lite_expiry, provider_subscription_id, subscription_status')
      .eq('id', decoded.id)
      .single();
    if (userErr || !user) return J(request, { error: 'User not found' }, 404);
    if (user.has_admin_privileges) {
      return J(request,
        { error: 'Super users cannot cancel directly. Transfer admin privileges first.', requiresTransfer: true },
        403
      );
    }
    if (!user.is_plus_user && !user.is_lite_user) {
      return J(request, { error: 'No active subscription to cancel' }, 400);
    }

    // Lifetime grants (invite codes) have no billing period — cancel immediately.
    const lifetime = !user.lite_expiry;
    if (lifetime) {
      const { error: updateErr } = await supabaseAdmin.from('users').update(buildDeactivationUpdate()).eq('id', user.id);
      if (updateErr) return J(request, { error: 'Failed to cancel subscription', details: updateErr.message }, 500);
      return J(request, { success: true, immediate: true, lifetime: true, message: 'Your lifetime subscription has been cancelled' });
    }

    const { configured } = razorpayKeys();
    const subId = (user as any).provider_subscription_id || '';

    // Cancel the real Razorpay subscription when possible.
    if (configured && subId) {
      try {
        await cancelRazorpaySubscription(subId, !immediate);
      } catch (e: any) {
        if (!immediate) {
          return J(request, { error: e?.message || 'Failed to cancel Razorpay subscription' }, 502);
        }
        // Immediate cancel: fall through and clear local access anyway.
      }
    }

    const update = immediate ? buildDeactivationUpdate() : buildCancelAtPeriodEndUpdate();
    const { error: updateErr } = await supabaseAdmin.from('users').update(update).eq('id', user.id);
    if (updateErr) return J(request, { error: 'Failed to cancel subscription', details: updateErr.message }, 500);

    return J(request, {
      success: true,
      immediate,
      message: immediate
        ? 'Your subscription has been cancelled'
        : `Your subscription will stay active until ${user.lite_expiry ? new Date(user.lite_expiry).toLocaleDateString('en-IN') : 'the end of the billing period'}, then it will not renew.`
    });
  } catch (e: any) {
    return J(request, { error: 'Internal server error', details: e?.message }, 500);
  }
}
