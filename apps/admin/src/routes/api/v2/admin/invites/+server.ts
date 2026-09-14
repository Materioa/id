import { json } from '@sveltejs/kit';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';
import { getDb } from '$lib/server/mongo';
import crypto from 'node:crypto';

async function checkAdmin(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  if (!token) return false;
  const decoded = await verifyToken(token);
  if (!decoded) return false;
  
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('has_admin_privileges')
    .eq('id', decoded.id)
    .single();
    
  return user?.has_admin_privileges === true;
}

export async function GET({ request }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    // Fetch these separately instead of relying on PostgREST's relationship
    // schema cache. This also works immediately after creating the table.
    const { data: invites, error: invitesError } = await supabaseAdmin
      .from('invites')
      .select('*')
      .order('created_at', { ascending: false });

    if (invitesError) throw invitesError;

    const inviteCodes = (invites || []).map((invite) => invite.code);
    const { data: redemptions, error: redemptionsError } = inviteCodes.length
      ? await supabaseAdmin
          .from('invite_redemptions')
          .select('invite_code, user_id, redeemed_at')
          .in('invite_code', inviteCodes)
          .order('redeemed_at', { ascending: true })
      : { data: [], error: null };

    if (redemptionsError) throw redemptionsError;

    const userIds = [...new Set((redemptions || []).map((redemption) => redemption.user_id))];
    const { data: users, error: usersError } = userIds.length
      ? await supabaseAdmin
          .from('users')
          .select('id, username, display_name, profile_picture, has_admin_privileges, is_plus_user')
          .in('id', userIds)
      : { data: [], error: null };

    if (usersError) throw usersError;

    const usersById = new Map((users || []).map((user) => [user.id, user]));
    const redemptionsByCode = new Map<string, any[]>();
    for (const redemption of redemptions || []) {
      const entries = redemptionsByCode.get(redemption.invite_code) || [];
      entries.push({
        redeemed_at: redemption.redeemed_at,
        user: usersById.get(redemption.user_id) || null
      });
      redemptionsByCode.set(redemption.invite_code, entries);
    }

    return json({
      invites: (invites || []).map((invite) => ({
        ...invite,
        redemptions: redemptionsByCode.get(invite.code) || []
      }))
    });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function POST({ request }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
    const decoded = await verifyToken(token);
    if (!decoded) return json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as any;
    
    // Support custom code or fallback to old hex format
    const code = body.customCode?.trim() || crypto.randomBytes(8).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + (body.expiresInDays || 30) * 24 * 60 * 60 * 1000).toISOString();
    
    const inviteDoc = {
      code,
      created_by: (decoded as any).id,
      contains_plus_perks: body.containsPlusPerks || false,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
      redeemed: false,
      max_uses: body.maxUses || 1,
      current_uses: 0
    };
    
    const { data, error } = await supabaseAdmin.from('invites').insert(inviteDoc).select().single();
    if (error) throw error;
    
    return json({ success: true, invite: data, code });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE({ request, url }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const code = url.searchParams.get('code');
    if (!code) return json({ error: 'Code is required' }, { status: 400 });
    
    const { error } = await supabaseAdmin.from('invites').delete().eq('code', code);
    if (error) throw error;
    
    return json({ success: true });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}
