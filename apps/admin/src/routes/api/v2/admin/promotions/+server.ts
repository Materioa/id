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

export async function GET({ request, url }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  
  const all = url.searchParams.get('all') === 'true';
  const db = await getDb();
  
  try {
    const query = all ? {} : { isActive: true };
    const promotions = await db.collection('promotions').find(query).sort({ createdAt: -1, lastUpdated: -1 }).toArray();
    
    // Map _id to id for the frontend
    const mappedPromos = promotions.map(p => ({
      id: p._id.toString(),
      title: p.title || '',
      description: p.description || p.body || '',
      category: p.category || 'whats-new',
      buttonText: (p.buttons?.primary?.text) || p.buttonText || '',
      buttonLink: p.link || p.buttonLink || '',
      imageUrl: (p.media && p.media.length > 0) ? p.media[0] : (p.imageUrl || ''),
      isActive: p.enabled ?? p.isActive ?? false,
      createdAt: p.createdAt || p.lastUpdated || new Date().toISOString()
    }));
    return json({ promotions: mappedPromos });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function POST({ request }) {
  if (!(await checkAdmin(request))) return json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const body = await request.json() as any;
    const db = await getDb();
    
    // If activating this one, we must deactivate others
    if (body.isActive) {
      await db.collection('promotions').updateMany({}, { $set: { isActive: false } });
    }
    
    const result = await db.collection('promotions').insertOne({
      title: body.title,
      description: body.description,
      category: body.category || 'whats-new',
      buttons: { primary: { text: body.buttonText, url: body.buttonLink } },
      buttonText: body.buttonText, // Fallback
      buttonLink: body.buttonLink, // Fallback
      media: body.imageUrl ? [body.imageUrl] : [],
      imageUrl: body.imageUrl, // Fallback
      mediaFit: body.mediaFit || 'cover',
      orientation: body.orientation || 'horizontal',
      enabled: body.isActive,
      isActive: body.isActive, // Fallback
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
    const db = await getDb();
    
    if (id) {
      if (body.isActive) {
        await db.collection('promotions').updateMany({}, { $set: { isActive: false, enabled: false } });
      }
      
      const updateData = { ...body };
      if (updateData.isActive !== undefined) {
        updateData.enabled = updateData.isActive;
      }
      
      if (updateData.buttonText !== undefined || updateData.buttonLink !== undefined) {
        updateData.buttons = { 
          primary: { 
             text: updateData.buttonText || '', 
             url: updateData.buttonLink || '' 
          } 
        };
      }
      
      if (updateData.imageUrl !== undefined) {
        updateData.media = updateData.imageUrl ? [updateData.imageUrl] : [];
      }
      
      if (updateData.description !== undefined) {
        updateData.body = updateData.description;
      }

      delete updateData.id;
      delete updateData._id;
      
      await db.collection('promotions').updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );
      return json({ success: true });
    }
    return json({ error: 'ID is required' }, { status: 400 });
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
    await db.collection('promotions').deleteOne({ _id: new ObjectId(id) });
    
    return json({ success: true });
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}
