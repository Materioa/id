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

export async function GET({ request, url }) {
  if (!(await checkAdmin(request))) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rawQuery = (url.searchParams.get('q') || '').trim();
    const query = rawQuery.replace(/^@/, '').trim();

    if (!query) {
      const { data: users, error } = await supabaseAdmin
        .from('users')
        .select('id, username, display_name, email, profile_picture')
        .limit(10);

      if (error) throw error;
      return json({ users: users || [] });
    }

    // Search by username, display_name, or email
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, email, profile_picture')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(15);

    if (error) throw error;
    return json({ users: users || [] });
  } catch (err: any) {
    return json({ error: err.message }, { status: 500 });
  }
}
