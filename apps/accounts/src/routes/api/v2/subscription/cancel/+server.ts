import { json } from '@sveltejs/kit';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';

export async function POST({ request }: any) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
    if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await verifyToken(token);
    if (!decoded) return json({ error: 'Invalid or expired token' }, { status: 401 });

    // Get user details
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, is_plus_user, is_lite_user, has_admin_privileges, provider_subscription_id')
      .eq('id', (decoded as any).id)
      .single();

    if (userErr || !user) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    // Super users cannot cancel — they must transfer admin first
    if (user.has_admin_privileges) {
      return json({
        error: 'Super users cannot cancel directly. You must first choose a successor to pass admin privileges to, or have another admin revoke your access.',
        requiresTransfer: true
      }, { status: 403 });
    }

    // Check user actually has a subscription to cancel
    if (!user.is_plus_user && !user.is_lite_user) {
      return json({ error: 'No active subscription to cancel' }, { status: 400 });
    }

    // Cancel the subscription (legacy gift-code path also clears billing fields)
    const { error: updateErr } = await supabaseAdmin
      .from('users')
      .update({
        is_plus_user: false,
        is_lite_user: false,
        lite_expiry: null,
        provider: null,
        provider_subscription_id: null,
        provider_order_id: null,
        subscription_plan: null,
        subscription_status: 'cancelled',
        subscription_current_period_end: null
      })
      .eq('id', user.id);

    if (updateErr) {
      return json({ error: 'Failed to cancel subscription' }, { status: 500 });
    }

    return json({
      success: true,
      message: 'Your subscription has been cancelled'
    });
  } catch (error: any) {
    return json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
