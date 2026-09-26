import { json } from '@sveltejs/kit';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';

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

export async function POST({ request, params }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const action = (params as any).action; // 'toggle-admin' or 'toggle-plus'
    const body = await request.json() as any;
    
    if (!body.userId) {
      return json({ error: 'userId is required' }, { status: 400 });
    }
    
    let updateData = {};
    if (action === 'toggle-admin') {
      updateData = { has_admin_privileges: body.makeAdmin === true };
    } else if (action === 'toggle-plus') {
      updateData = { is_plus_user: body.makePlus === true };
    } else {
      return json({ error: 'Invalid action' }, { status: 400 });
    }
    
    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', body.userId)
      .select()
      .single();
      
    if (error) throw error;

    // Admin-granted Plus is a lifetime grant — record a ₹0 receipt for invoices.
    // (One per user; repeated toggles must not stack receipts.)
    if (action === 'toggle-plus' && body.makePlus === true) {
      try {
        const { data: existing } = await supabaseAdmin
          .from('payments')
          .select('id')
          .eq('user_id', body.userId)
          .eq('provider', 'gift')
          .limit(1)
          .maybeSingle();
        if (!existing) {
          await supabaseAdmin.from('payments').insert({
            user_id: body.userId,
            plan: 'pro',
            amount_paise: 0,
            currency: 'inr',
            status: 'succeeded',
            provider: 'gift',
            period_start: new Date().toISOString(),
            period_end: null
          });
        }
      } catch {}
    }
    
    return json({ success: true, user: data });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}
