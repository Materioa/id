import { json, type RequestHandler } from '@sveltejs/kit';
import { getInsightroomDb } from '$lib/server/mongo';
import { ObjectId } from 'mongodb';
import { validateToken, getCookieToken } from '$lib/server/insightroom-auth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const GET: RequestHandler = async ({ request, url, cookies, fetch }) => {
  let token = getCookieToken(cookies);
  const authHeader = request.headers.get('Authorization');
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  if (!token) return json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

  const { user, accessTier } = await validateToken(token, fetch);
  if (!user || accessTier !== 'super') {
    return json({ error: 'Unauthorized: Admin privileges required' }, { status: 403, headers: corsHeaders });
  }

  try {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Post ID is required' }, { status: 400, headers: corsHeaders });

    const db = await getInsightroomDb();
    const versionsCollection = db.collection('post_versions');

    const versions = await versionsCollection
      .find({ post_id: new ObjectId(id) })
      .sort({ version_saved_at: -1 })
      .limit(30)
      .toArray();

    return json({ success: true, versions }, { headers: corsHeaders });
  } catch (err: any) {
    console.error('[Admin Versions API Error]:', err);
    return json({ error: err.message || 'Failed to fetch versions' }, { status: 500, headers: corsHeaders });
  }
};
