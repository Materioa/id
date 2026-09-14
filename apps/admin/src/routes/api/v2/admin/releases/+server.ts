import { json } from '@sveltejs/kit';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';
import { getDb } from '$lib/server/mongo';
import { ObjectId } from 'mongodb';

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
    const releases = await db.collection('releases').find({}).toArray();
    const mapped = releases.map(r => ({
      id: r._id.toString(),
      version: r.version,
      branch: r.branch || '',
      notes: r.logs ? (Array.isArray(r.logs) ? r.logs.join('\n') : r.logs) : (r.notes || ''),
      date: r.date || r.build || r.createdAt || new Date().toISOString(),
      link: r.link || '',
      status: r.status || 'Active'
    }));
    
    // Sort mapped releases descending by date
    mapped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return json({ releases: mapped });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function POST({ request }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const body = await request.json() as any;
    const db = await getDb();
    const result = await db.collection('releases').insertOne({
      version: body.version,
      branch: body.branch,
      notes: body.notes,
      date: body.date,
      link: body.link,
      status: body.status || 'Active',
      createdAt: new Date()
    });
    return json({ success: true, id: result.insertedId.toString() });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function PUT({ request, params, url }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const body = await request.json() as any;
    const id = body.id || (params as any)?.id || url.searchParams.get('id');
    if (!id) return json({ error: 'ID is required' }, { status: 400 });
    
    const db = await getDb();
    const updateData = { ...body };
    delete updateData.id;
    delete updateData._id;
    
    await db.collection('releases').updateOne({ _id: new ObjectId(id) }, { $set: updateData });
    return json({ success: true });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE({ request, params, url }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const id = (params as any)?.id || url.searchParams.get('id');
    if (!id) return json({ error: 'ID is required' }, { status: 400 });
    
    const db = await getDb();
    await db.collection('releases').deleteOne({ _id: new ObjectId(id) });
    return json({ success: true });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}
