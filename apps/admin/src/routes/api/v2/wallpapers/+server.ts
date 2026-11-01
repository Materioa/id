import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/mongo';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'public, max-age=60, s-maxage=300'
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
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
      endDate: w.endDate || null
    }));

    return json({ success: true, wallpapers: formatted }, { headers: corsHeaders });
  } catch (err: any) {
    return json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
