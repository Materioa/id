import { json } from '@sveltejs/kit';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';

export async function POST({ request }: any) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
    if (!token) return json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await verifyToken(token);
    if (!decoded) return json({ error: 'Invalid or expired token' }, { status: 401 });

    const body = await request.json() as any;
    const code = (body.code || '').trim();

    if (!code) {
      return json({ error: 'Gift code is required' }, { status: 400 });
    }

    // Check if user already has an active subscription
    const { data: user, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, is_plus_user, is_lite_user, has_admin_privileges')
      .eq('id', (decoded as any).id)
      .single();

    if (userErr || !user) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    if (user.is_plus_user || user.is_lite_user || user.has_admin_privileges) {
      return json({ error: 'You already have an active subscription' }, { status: 409 });
    }

    // Look up the invite code
    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from('invites')
      .select('*')
      .eq('code', code)
      .single();

    if (inviteErr || !invite) {
      return json({ error: 'Invalid gift code' }, { status: 404 });
    }

    if (invite.redeemed || (invite.max_uses > 0 && invite.current_uses >= invite.max_uses)) {
      return json({ error: 'This code has reached its maximum uses' }, { status: 410 });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return json({ error: 'This gift code has expired' }, { status: 410 });
    }

    if (!invite.contains_plus_perks) {
      return json({ error: 'This code does not include a subscription' }, { status: 400 });
    }


    // Record every redemption instead of overwriting a single user reference.
    const { error: redemptionErr } = await supabaseAdmin
      .from('invite_redemptions')
      .insert({ invite_code: invite.code, user_id: user.id });

    if (redemptionErr) {
      if (redemptionErr.code === '23505') {
        return json({ error: 'You have already used this gift code' }, { status: 409 });
      }
      return json({ error: 'Failed to record gift code redemption' }, { status: 500 });
    }

    // Mark invite as redeemed if max uses reached, and increment uses.
    const newUses = (invite.current_uses || 0) + 1;
    const isFullyRedeemed = invite.max_uses > 0 ? newUses >= invite.max_uses : true;
    const { data: updatedInvite, error: inviteUpdateErr } = await supabaseAdmin
      .from('invites')
      .update({
        redeemed: isFullyRedeemed,
        current_uses: newUses
      })
      .eq('code', invite.code)
      .eq('current_uses', invite.current_uses || 0)
      .select('current_uses')
      .maybeSingle();

    if (inviteUpdateErr) {
      await supabaseAdmin
        .from('invite_redemptions')
        .delete()
        .eq('invite_code', invite.code)
        .eq('user_id', user.id);
      return json({ error: 'Failed to update gift code usage' }, { status: 500 });
    }

    // Another redemption may have consumed the last available use after the
    // initial lookup. Remove this row so the count and redemption records stay in sync.
    if (!updatedInvite) {
      await supabaseAdmin
        .from('invite_redemptions')
        .delete()
        .eq('invite_code', invite.code)
        .eq('user_id', user.id);
      return json({ error: 'This code has reached its maximum uses' }, { status: 410 });
    }

    // Apply a LIFETIME Pro grant (invite codes are the only forever path:
    // provider purchases always carry a lite_expiry).
    const { error: updateErr } = await supabaseAdmin
      .from('users')
      .update({ is_plus_user: true, lite_expiry: null, subscription_plan: 'pro', subscription_status: 'lifetime' })
      .eq('id', user.id);

    if (updateErr) {
      await Promise.all([
        supabaseAdmin
          .from('invite_redemptions')
          .delete()
          .eq('invite_code', invite.code)
          .eq('user_id', user.id),
        supabaseAdmin
          .from('invites')
          .update({ redeemed: invite.redeemed, current_uses: invite.current_uses || 0 })
          .eq('code', invite.code)
          .eq('current_uses', newUses)
      ]);
      return json({ error: 'Failed to apply subscription' }, { status: 500 });
    }

    // Record a ₹0 receipt so lifetime holders get invoices too.
    try {
      await supabaseAdmin.from('payments').insert({
        user_id: user.id,
        plan: 'pro',
        amount_paise: 0,
        currency: 'inr',
        status: 'succeeded',
        provider: 'gift',
        period_start: new Date().toISOString(),
        period_end: null
      });
    } catch {}

    return json({
      success: true,
      plan: 'Pro',
      message: 'Welcome to Materio Pro!'
    });
  } catch (error: any) {
    return json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
