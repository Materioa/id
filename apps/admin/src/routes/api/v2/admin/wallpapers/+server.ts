import { json } from '@sveltejs/kit';
import { supabaseAdmin, verifyToken } from '$lib/server/utils';
import { getDb } from '$lib/server/mongo';
import { ObjectId } from 'mongodb';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '$env/dynamic/private';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || 'dvsdsl7iw',
  api_key: env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY || '412819653886923',
  api_secret: env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET || 'LPARAweIryTEMsJ_tmv4-RtkFGs'
});

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
  try {
    const db = await getDb();
    const wallpapers = await db
      .collection('wallpapers')
      .find({})
      .sort({ isDefault: -1, createdAt: 1 })
      .toArray();

    const formatted = wallpapers.map((w) => ({
      id: w._id.toString(),
      name: w.name || '',
      slug: w.slug || '',
      type: w.type || 'standard',
      isDefault: !!w.isDefault,
      desktopImage: w.desktopImage || '',
      mobileImage: w.mobileImage || w.desktopImage || '',
      slots: Array.isArray(w.slots) ? w.slots : [],
      startDate: w.startDate || null,
      endDate: w.endDate || null,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt
    }));

    return json({ success: true, wallpapers: formatted });
  } catch (err: any) {
    console.error('Failed to get wallpapers:', err);
    return json({ error: err.message }, { status: 500 });
  }
}

export async function POST({ request }) {
  if (!(await checkAdmin(request))) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contentType = request.headers.get('content-type') || '';

  // Handle Cloudinary image upload via FormData
  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      if (!file) return json({ error: 'Missing image file' }, { status: 400 });

      const buffer = Buffer.from(await file.arrayBuffer());
      const base64 = `data:${file.type || 'image/webp'};base64,${buffer.toString('base64')}`;

      const uploadRes = await cloudinary.uploader.upload(base64, {
        folder: 'materio/wallpapers',
        format: 'webp',
        transformation: [{ fetch_format: 'webp', quality: 'auto:best' }]
      });

      return json({ success: true, url: uploadRes.secure_url });
    } catch (err: any) {
      console.error('Cloudinary upload error:', err);
      return json({ error: err.message }, { status: 500 });
    }
  }

  // Handle JSON wallpaper creation
  try {
    const body = await request.json();
    const { name, type, isDefault, desktopImage, mobileImage, slots, startDate, endDate } = body;

    if (!name?.trim()) {
      return json({ error: 'Wallpaper name is required' }, { status: 400 });
    }

    const db = await getDb();
    const coll = db.collection('wallpapers');

    if (isDefault) {
      await coll.updateMany({}, { $set: { isDefault: false } });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const doc = {
      name: name.trim(),
      slug,
      type: type === 'dynamic' ? 'dynamic' : 'standard',
      isDefault: !!isDefault,
      desktopImage: desktopImage || '',
      mobileImage: mobileImage || desktopImage || '',
      slots: Array.isArray(slots) ? slots : [],
      startDate: startDate || null,
      endDate: endDate || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const res = await coll.insertOne(doc);
    return json({ success: true, id: res.insertedId.toString(), wallpaper: { ...doc, id: res.insertedId.toString() } });
  } catch (err: any) {
    console.error('Wallpaper create error:', err);
    return json({ error: err.message }, { status: 500 });
  }
}

export async function PUT({ request, url }) {
  if (!(await checkAdmin(request))) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Missing wallpaper id' }, { status: 400 });

  try {
    const body = await request.json();
    const db = await getDb();
    const coll = db.collection('wallpapers');

    if (body.isDefault) {
      await coll.updateMany({}, { $set: { isDefault: false } });
    }

    const updates: Record<string, any> = {
      updatedAt: new Date()
    };

    if (typeof body.name === 'string') updates.name = body.name.trim();
    if (typeof body.type === 'string') updates.type = body.type;
    if (typeof body.isDefault === 'boolean') updates.isDefault = body.isDefault;
    if (typeof body.desktopImage === 'string') updates.desktopImage = body.desktopImage;
    if (typeof body.mobileImage === 'string') updates.mobileImage = body.mobileImage;
    if (Array.isArray(body.slots)) updates.slots = body.slots;
    if (body.startDate !== undefined) updates.startDate = body.startDate;
    if (body.endDate !== undefined) updates.endDate = body.endDate;

    await coll.updateOne({ _id: new ObjectId(id) }, { $set: updates });
    return json({ success: true });
  } catch (err: any) {
    console.error('Wallpaper update error:', err);
    return json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE({ request, url }) {
  if (!(await checkAdmin(request))) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'Missing wallpaper id' }, { status: 400 });

  try {
    const db = await getDb();
    await db.collection('wallpapers').deleteOne({ _id: new ObjectId(id) });
    return json({ success: true });
  } catch (err: any) {
    console.error('Wallpaper delete error:', err);
    return json({ error: err.message }, { status: 500 });
  }
}
