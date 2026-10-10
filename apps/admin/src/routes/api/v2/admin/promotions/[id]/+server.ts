import { json } from '@sveltejs/kit';
import { ObjectId } from 'mongodb';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';
import { getDb } from '$lib/server/mongo';

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

// Promotions live in MongoDB (see ../+server.ts); this route used to delete
// from a Supabase table that doesn't hold them.
export async function DELETE({ request, params }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  
  const { id } = params;
  if (!id || !ObjectId.isValid(id)) return json({ error: 'Invalid ID' }, { status: 400 });

  try {
    const db = await getDb();
    await db.collection('promotions').deleteOne({ _id: new ObjectId(id) });
    return json({ success: true });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}
