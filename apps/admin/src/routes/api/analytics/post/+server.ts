import { json, type RequestHandler } from '@sveltejs/kit';
import { getPostAnalytics } from '$lib/server/insightroom-analytics';
import { validateToken, getCookieToken } from '$lib/server/insightroom-auth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const GET: RequestHandler = async ({ url, cookies, fetch, request }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = getCookieToken(cookies) || '';
    }

    const { user, accessTier } = await validateToken(token, fetch);
    if (!user || accessTier !== 'super') {
      return json({ error: 'Unauthorized: Admin access required' }, { status: 403, headers: corsHeaders });
    }

    const postId = url.searchParams.get('postId');
    if (!postId) {
      return json({ error: 'postId is required' }, { status: 400, headers: corsHeaders });
    }

    const daysParam = url.searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : 14;

    const analytics = await getPostAnalytics(postId, days);
    return json(analytics, { headers: corsHeaders });
  } catch (error) {
    console.error('[Post Analytics API Error]:', error);
    return json({ error: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
  }
};
