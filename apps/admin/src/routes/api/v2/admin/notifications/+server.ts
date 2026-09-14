import { json } from '@sveltejs/kit';
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

export async function GET({ request }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const db = await getDb();
    const notifications = await db.collection('notifications').find({}).sort({ timestamp: -1, createdAt: -1, sentAt: -1 }).toArray();
    
    // Map _id to id and map old fields to new fields
    const mappedNotifs = notifications.map(n => ({
      id: n._id.toString(),
      title: n.title || '',
      body: n.message || n.body || '',
      link: n.link || '',
      category: n.category || '',
      sentAt: n.sentAt || n.date || (n.timestamp ? new Date(n.timestamp).toISOString() : new Date().toISOString()),
      status: n.status || 'Sent'
    }));
    return json({ notifications: mappedNotifs });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE({ request, url }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'ID is required' }, { status: 400 });
    
    const db = await getDb();
    const { ObjectId } = await import('mongodb');
    await db.collection('notifications').deleteOne({ _id: new ObjectId(id) });
    
    return json({ success: true });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function PUT({ request, url }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'ID is required' }, { status: 400 });
    
    const body = await request.json() as any;
    const db = await getDb();
    const { ObjectId } = await import('mongodb');
    
    const updateData = {
      title: body.title,
      message: body.body,
      category: body.category,
      link: body.link,
      timestamp: Date.now() // Update timestamp so it shows up at the top
    };
    
    await db.collection('notifications').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    
    return json({ success: true });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}
